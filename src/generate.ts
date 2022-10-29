import {
  FileInfo,
  FunctionInfo,
  MethodInfo,
  StructInfo,
  StructField,
  InterfaceInfo,
  ClassInfo,
  EnumInfo,
} from './InfoTypes'
import { Module } from './Module'
import fmtsrc from './fmtsrc'

export const headerIncludes = (module: Module) => {
  let pathSegments = module.fileInfo.modulePath.length
  let relativePath =
    pathSegments === 1 ? '.' : new Array(pathSegments - 1).fill('..').join('/')
  return module
    .getHeaders()
    .map(([path, type]) =>
      type === 'system'
        ? `#include <${path}>`
        : `#include "${relativePath}/${path}"`,
    )
    .join('\n')
}

function generateFunctionDeclaration(fn: FunctionInfo, module: Module) {
  const arglist = fn.args
    .map(arg => `${module.mapArg(arg.type)} ${arg.name}`)
    .join(', ')

  return `${module.mapRet(fn.ret)} ${fn.cName}(${arglist});`
}

function generateStructDeclaration(struct: StructInfo, module: Module) {
  let fields = struct.fields.map(field => {
    if (field.isOptional) {
      module.requireHeader('optional', 'system')
      return `std::optional<${module.mapDecl(field.type)}> ${field.cName};`
    } else {
      return `${module.mapDecl(field.type)} ${field.cName};`
    }
  })

  return fmtsrc`
    struct ${struct.name} {
      ${fields}
    };
    `
}

function generateInterfaceDeclaration(iface: InterfaceInfo, module: Module) {
  let methods = iface.methods.map(method => {
    const args = method.args
      .map(arg => `${module.mapArg(arg.type)} ${arg.name}`)
      .join(', ')
    return `virtual auto ${method.cName}(${args}) -> ${module.mapRet(
      method.ret,
    )} = 0;`
  })
  return fmtsrc`
    class ${iface.name} : public virtual obol::ObjBase {
    public:
      virtual ~${iface.name}(){
        assert(binding_data == nullptr);
      }
      ${methods}

      void** unsafe_get_binding_data(){ return &binding_data; }
    private:
      void* binding_data = nullptr;
    };
    `
}

function generateClassDeclaration(classInfo: ClassInfo, module: Module) {
  const params = (args: { name: string; type: string }[]) =>
    args.map(arg => `${module.mapArg(arg.type)} ${arg.name}`).join(', ')

  let methods = classInfo.methods.map(method => {
    const args = params(method.args)
    if (method.isStatic) {
      return `static auto ${method.cName}(${args}) -> ${module.mapRet(
        method.ret,
      )};`
    } else {
      return `auto ${method.cName}(${args}) -> ${module.mapRet(method.ret)};`
    }
  })

  module.requireHeader('memory', 'system')
  const ctorArgs = params(classInfo.constructor.args)
  let constructor = `${classInfo.name}(${ctorArgs});`
  let destructor = `~${classInfo.name}();`

  module.requireHeader('cassert', 'system')
  return fmtsrc`
    class ${classInfo.name} : public virtual obol::ObjBase {
    public:
      struct Self;

      ${constructor}
      ${destructor}
      ${methods}

      // for obol binding use only
      void** unsafe_get_binding_data(){ return &binding_data; }

      // used to access the internals from within the same module
      auto unsafe_get_self() -> Self* {return self.get(); }

    private:
      void* binding_data = nullptr;
      std::unique_ptr<Self> self;
    };
    `
}

function generateEnumDeclaration(enumInfo: EnumInfo) {
  let enumValues = enumInfo.values.map(
    value => `${value.name} = ${value.value},`,
  )
  return fmtsrc`
    enum class ${enumInfo.name} {
      ${enumValues}
    };
    `
}

export function header(info: FileInfo, module: Module): string {
  const forwardTypeDeclarations = [
    ...info.classTypes,
    ...info.structTypes,
    ...info.interfaceTypes,
  ].flatMap(
    type => fmtsrc`
      ${type.kind === 'struct' ? 'struct' : 'class'} ${type.name};
      `,
  )

  const structDeclarations = info.structTypes.flatMap(struct =>
    generateStructDeclaration(struct, module),
  )

  const interfaceDeclarations = info.interfaceTypes.flatMap(iface =>
    generateInterfaceDeclaration(iface, module),
  )

  const functionDeclarations = info.functions.map(fn =>
    generateFunctionDeclaration(fn, module),
  )

  const classDeclarations = info.classTypes.flatMap(cls =>
    generateClassDeclaration(cls, module),
  )

  const enumDeclarations = info.enumTypes.flatMap(cls =>
    generateEnumDeclaration(cls),
  )

  module.requireHeader('obol.hpp', 'relative')
  return fmtsrc`
    namespace ${info.modulePath.join('::')} {
      ${enumDeclarations}
      ${forwardTypeDeclarations}
      ${structDeclarations}
      ${interfaceDeclarations}
      ${classDeclarations}
      ${functionDeclarations}
    }
    `.join('\n')
}

function getRequireFunctionName(rawTypeName: string, module: Module): string {
  let [resolvedModule, resolvedTypeName] =
    module.resolveModuleOfType(rawTypeName)
  let typeName = module.resolveTypeAlias(rawTypeName)
  return resolvedModule
    ? `duk_require_${resolvedModule.fileInfo.modulePath.join(
        '_',
      )}_${resolvedTypeName}`
    : `duk_require_${typeName}`
}

function getPushFunctionName(rawTypeName: string, module: Module): string {
  let [resolvedModule, resolvedTypeName] =
    module.resolveModuleOfType(rawTypeName)
  let typeName = module.resolveTypeAlias(rawTypeName)
  return resolvedModule
    ? `duk_push_${resolvedModule.fileInfo.modulePath.join(
        '_',
      )}_${resolvedTypeName}`
    : `duk_push_${typeName}`
}

const getBindingInfoTypeName = (
  classInfo: ClassInfo | InterfaceInfo,
  module: Module,
) => `${module.fileInfo.modulePath.join('_')}_${classInfo.name}_binding_data`

const collectArgsIntoVariables = (fn: FunctionInfo, module: Module) =>
  fn.args.map(
    (arg, i) =>
      `auto arg${i} = ${getRequireFunctionName(arg.type, module)}(ctx, ${i});`,
  )

const passArgs = (fn: FunctionInfo) =>
  fn.args.map((_arg, i) => `arg${i}`).join(', ')

const collectReturn = (typeName: string) =>
  typeName === 'void' ? '' : 'auto ret = '

function doReturn(retType: string, module: Module) {
  if (retType === 'void') {
    return 'return 0;'
  }
  return fmtsrc`
    duk_require_stack(ctx, 1);
    ${getPushFunctionName(retType, module)}(ctx, ret);
    return 1;
    `
}

function generateWrapperFunction(fn: FunctionInfo, module: Module) {
  return fmtsrc`
    int ${fn.cName}_wrapper(duk_context* ctx){
      ${collectArgsIntoVariables(fn, module)}
      ${collectReturn(fn.ret)}${fn.cName}(${passArgs(fn)});
      ${doReturn(fn.ret, module)}
    }
    `
}

function generateStructRequireFunction(struct: StructInfo, module: Module) {
  let getField = (field: StructField) => {
    let fnName = getRequireFunctionName(field.type, module)
    let doAssign = fmtsrc`
      result.${field.cName} = ${fnName}(ctx, -1);
      `

    // wrap optionals to do a check first
    if (field.isOptional) {
      doAssign = fmtsrc`
        if (!duk_is_undefined(ctx, -1)){
          ${doAssign}
        }
        `
    }

    return fmtsrc`
      // ${field.cName}
      duk_get_prop_literal(ctx, index, "${field.tsName}");
      ${doAssign}
      duk_pop(ctx);
      `
  }

  let populateFields = struct.fields.flatMap(getField)
  let fnName = getRequireFunctionName(struct.name, module)

  return fmtsrc`
    ${struct.name} ${fnName}(duk_context* ctx, int index){
      // leave space for each field to be accessed
      duk_require_stack(ctx, 1);

      ${struct.name} result = {};
      ${populateFields}

      return result;
    }

    `
}

function generateStructPushFunction(struct: StructInfo, module: Module) {
  let setField = (field: StructField) => {
    let fnName = getPushFunctionName(field.type, module)
    if (field.isOptional) {
      return fmtsrc`
        if (val.${field.cName}){
          ${fnName}(ctx, *val.${field.cName});
          duk_put_prop_literal(ctx, -2, "${field.tsName}");
        }

        `
    } else {
      return fmtsrc`
        ${fnName}(ctx, val.${field.cName});
        duk_put_prop_literal(ctx, -2, "${field.tsName}");

        `
    }
  }

  let populateFields = struct.fields.flatMap(setField)
  let fnName = getPushFunctionName(struct.name, module)

  return fmtsrc`
    void ${fnName}(duk_context* ctx, ${struct.name} const& val){
      // leave space for the object and each field
      duk_require_stack(ctx, 2);
      duk_push_object(ctx);

      ${populateFields}
    }

    `
}

function generateBindingInfoType(
  typeInfo: ClassInfo | InterfaceInfo,
  module: Module,
) {
  return fmtsrc`
    struct ${getBindingInfoTypeName(typeInfo, module)} {
      std::shared_ptr<${typeInfo.name}> self_ref;
      std::shared_ptr<obol::ObjBase> self_obj_ptr;
      void* js_heapptr = nullptr;
      static constexpr char const wrapper_key[] =
        DUK_HIDDEN_SYMBOL("${typeInfo.name}_wrapper_key")
      ;
    };
    `
}

function generateFinalizer(
  typeInfo: ClassInfo | InterfaceInfo,
  module: Module,
) {
  let binding = getBindingInfoTypeName(typeInfo, module)
  return fmtsrc`
    static int ${typeInfo.name}_finalizer(duk_context* ctx) {
      duk_require_object(ctx, -1);
      duk_get_prop_literal(ctx, -1, ${binding}::wrapper_key);
      void* val_ptr = duk_require_pointer(ctx, -1);
      ${binding}* binding = reinterpret_cast<${binding}*>(val_ptr);
      assert(*binding->self_ref->unsafe_get_binding_data() == binding);
      *binding->self_ref->unsafe_get_binding_data() = nullptr;
      binding->~${binding}();
      duk_free(ctx, binding);
      return 0;
    }
    `
}

function generateObjectPushFunction(
  typeInfo: ClassInfo | InterfaceInfo,
  module: Module,
) {
  let binding = getBindingInfoTypeName(typeInfo, module)
  return fmtsrc`
    void ${getPushFunctionName(
      typeInfo.name,
      module,
    )}(duk_context* ctx, std::shared_ptr<${typeInfo.name}> val){
      // leave space for the object and each field
      duk_require_stack(ctx, 3);

      auto binding_data = static_cast<${binding}*>(*val->unsafe_get_binding_data());
      if (binding_data == nullptr){
        // create the wrapper object, leave it on the stack for return
        duk_push_object(ctx);

        // set the finalizer
        duk_push_c_lightfunc(ctx, ${typeInfo.name}_finalizer, 1, 1, 0);
        duk_set_finalizer(ctx, -2);

        // set the prototype which is stored in the global stash
        duk_push_global_stash(ctx);
        duk_get_prop_literal(ctx, -1, ${binding}::wrapper_key);
        if(!duk_is_object(ctx, -1)){
          duk_pop(ctx); // the undefined
          duk_push_global_stash(ctx);
          duk_push_object(ctx); // the new prototype
          duk_dup_top(ctx); // add a referenced to leave on the stack
          ${typeInfo.methods.flatMap(method => {
            let len = method.args.length.toString()
            return fmtsrc`
              duk_push_c_lightfunc(ctx, ${typeInfo.name}_${method.cName}_method_wrapper, ${len}, ${len}, 0);
              duk_put_prop_literal(ctx, -2, "${method.tsName}");
              `
          })}
          duk_put_prop_literal(ctx, -3, ${getBindingInfoTypeName(
            typeInfo,
            module,
          )}::wrapper_key); // assign the prototype into the stash
          duk_swap(ctx, -1, -2); // the stash and the prototype
          duk_pop(ctx); // pop the stash
        }
        duk_set_prototype(ctx, -3);
        duk_pop(ctx); // pop the stash

        // set up the binding data
        binding_data = static_cast<${binding}*>(
          duk_alloc(ctx, sizeof(${binding}))
        );
        new (binding_data) ${binding}();
        *val->unsafe_get_binding_data() = binding_data;
        binding_data->js_heapptr = duk_get_heapptr(ctx, -1);
        binding_data->self_ref = val;
        binding_data->self_obj_ptr = val;

        // set the native_obj pointer
        void* ptr_to_self_obj_ptr = &binding_data->self_obj_ptr;
        duk_push_pointer(ctx, ptr_to_self_obj_ptr);
        duk_put_prop_literal(ctx, -2, native_obj_key);

        // assign the binding data into the object
        duk_push_pointer(ctx, binding_data);
        duk_put_prop_literal(ctx, -2, ${binding}::wrapper_key);
      } else {
        // push the object we already know about
        duk_push_heapptr(ctx, binding_data->js_heapptr);
      }
    }
    `
}

function generateClassPassingFunctions(classInfo: ClassInfo, module: Module) {
  let binding = getBindingInfoTypeName(classInfo, module)
  return fmtsrc`
    ${generateBindingInfoType(classInfo, module)}
    ${generateFinalizer(classInfo, module)}
    ${generateObjectPushFunction(classInfo, module)}

    auto ${getRequireFunctionName(
      classInfo.name,
      module,
    )}(duk_context* ctx, int index) -> std::shared_ptr<${classInfo.name}> {
      duk_require_stack(ctx, 2);
      duk_require_object(ctx, index);
      duk_get_prop_literal(ctx, index, ${binding}::wrapper_key);
      void* val_ptr = duk_require_pointer(ctx, -1);
      ${binding}* binding = static_cast<${binding}*>(val_ptr);
      assert(binding);
      auto res = binding->self_ref;
      duk_pop(ctx); // pop the ptr
      return res;
    }
    `
}

function generateInterfaceWrapper(iface: InterfaceInfo, module: Module) {
  const implType = `${iface.name}_DukImpl`
  module.requireHeader('memory', 'system')
  module.requireHeader('iostream', 'system')

  const generateMethod = (method: FunctionInfo) => {
    const arglist = method.args
      .map(arg => `${module.mapArg(arg.type)} ${arg.name}`)
      .join(', ')

    const generatePush = (arg: { name: string; type: string }) => {
      return `${getPushFunctionName(arg.type, module)}(ctx, ${arg.name});`
    }

    const argPushes = method.args.map(generatePush)

    const doReturn =
      method.ret === 'void'
        ? 'duk_set_top(ctx, starting_top);'
        : fmtsrc`
        auto ret = ${getRequireFunctionName(method.ret, module)}(ctx, -1);
        duk_set_top(ctx, starting_top);
        return ret;
        `

    return fmtsrc`
      ${module.mapRet(method.ret)} ${method.cName}(${arglist}) override {
        int starting_top = duk_get_top(ctx);
        // make room for the function, this, and all args
        duk_require_stack(ctx, 2 + ${method.args.length.toString()});

        push_instance();
        int index = duk_get_top_index(ctx);
        // std::cout << "invoking wrapped method: <" << "${
          method.tsName
        }" << ">" << std::endl;
        duk_push_literal(ctx, "${method.tsName}");
        ${argPushes}
        duk_call_prop(ctx, index, ${method.args.length.toString()});
        ${doReturn}
      }

      `
  }

  const methods = iface.methods.flatMap(generateMethod)

  const impl = fmtsrc`
    class ${implType} : public ${iface.name} {
    public:
      ${implType}(duk_context* ctx_, int index)
        : ctx{ctx_}
      {
        create_id();

        // add the object at index into the stash
        duk_require_stack(ctx, 2); // make space
        duk_push_global_stash(ctx); // push the global stash
        duk_dup(ctx, index); // push the value at index
        duk_put_prop_lstring(ctx, -2, id.c_str(), id.size());
        duk_pop(ctx); // the global stash
      }

      ~${implType}(){
        duk_require_stack(ctx, 1); // make space
        duk_push_global_stash(ctx); // push the global stash
        duk_del_prop_lstring(ctx, -1, id.c_str(), id.size());
        duk_pop(ctx);
      }

      ${methods}

    private:
      void push_instance(){
        duk_require_stack(ctx, 2);
        duk_push_global_stash(ctx);
        duk_get_prop_lstring(ctx, -1, id.c_str(), id.size());
        duk_remove(ctx, -2); // remove the stash, leaving only the instance
      }

      void create_id(){
        uintptr_t ptr_id = reinterpret_cast<uintptr_t>(this);
        id = std::string{DUK_HIDDEN_SYMBOL("${implType}:")} + std::to_string(ptr_id);
      }

      duk_context* ctx;
      std::string id = std::string{};
    };
    `

  let binding = getBindingInfoTypeName(iface, module)

  let requireFunctionName = getRequireFunctionName(iface.name, module)

  return fmtsrc`
    ${impl}

    ${generateBindingInfoType(iface, module)}

    std::shared_ptr<${
      iface.name
    }> ${requireFunctionName}(duk_context* ctx, int index){
      duk_require_object(ctx, index);
      duk_get_prop_literal(ctx, index, ${binding}::wrapper_key);
      if (duk_is_pointer(ctx, -1)){
        ${binding}* binding = static_cast<${binding}*>(
          duk_require_pointer(ctx, -1)
        );
        duk_pop(ctx); // pointer
        return binding->self_ref;
      }
      duk_pop(ctx); // the undefined that was left from checking wrapperKey

      duk_get_prop_literal(ctx, index, native_obj_key);
      if (duk_is_pointer(ctx, -1)){
        // see if the native object implements the interface and return it
        std::shared_ptr<obol::ObjBase> obj_ref = *static_cast<std::shared_ptr<obol::ObjBase>*>(
          duk_require_pointer(ctx, -1)
        );
        duk_pop(ctx); // pointer
        std::shared_ptr<${iface.name}> impl =
          std::dynamic_pointer_cast<${iface.name}>(obj_ref);
        if (impl){
          return impl;
        } else {
          std::cout
            << "warning: wrapping native class '"
            << typeid(obj_ref).name()
            << "' to support interface '${iface.name}'"
            << std::endl;
        }
      } else {
        duk_pop(ctx); // the undefined that was left from checking native_obj_key
      }

      auto result = std::make_shared<${implType}>(ctx, index);
      // set the finalizer
      duk_get_finalizer(ctx, index);
      assert(duk_is_undefined(ctx, -1));
      duk_pop(ctx); // the finalizer
      duk_push_c_lightfunc(ctx, ${iface.name}_finalizer, 1, 1, 0);
      duk_set_finalizer(ctx, index);

      // setup the binding data
      auto binding_data_ptr = result->unsafe_get_binding_data();
      assert(binding_data_ptr != nullptr && *binding_data_ptr == nullptr);
      *binding_data_ptr = static_cast<${binding}*>(
        duk_alloc(ctx, sizeof(${binding}))
      );
      auto binding_data = static_cast<${binding}*>(*binding_data_ptr);
      new (binding_data) ${binding}();
      binding_data->js_heapptr = duk_get_heapptr(ctx, index);
      binding_data->self_ref = result;
      binding_data->self_obj_ptr = result;

      // assign the binding data into the object
      duk_push_pointer(ctx, binding_data);
      duk_put_prop_literal(ctx, index, ${binding}::wrapper_key);

      return result;
    }

    ${generateFinalizer(iface, module)}

    ${generateObjectPushFunction(iface, module)}
    `
}

function generateConstructorWrapper(classInfo: ClassInfo, module: Module) {
  const callArgs = passArgs(classInfo.constructor)
  module.requireHeader('memory', 'system')

  return fmtsrc`
    int ${classInfo.name}_constructor_wrapper(duk_context* ctx){
      ${collectArgsIntoVariables(classInfo.constructor, module)}
      auto ret = std::make_shared<${classInfo.name}>(${callArgs});
      duk_require_stack(ctx, 1);
      ${getPushFunctionName(classInfo.name, module)}(ctx, ret);
      return 1;
    }
    `
}

function generateMethodWrapper(
  methodInfo: MethodInfo,
  typeInfo: ClassInfo | InterfaceInfo,
  module: Module,
) {
  let getRet = collectReturn(methodInfo.ret)
  let doCall = `${getRet}self->${methodInfo.cName}(${passArgs(methodInfo)});`
  return fmtsrc`
    int ${typeInfo.name}_${methodInfo.cName}_method_wrapper(duk_context* ctx){
      duk_push_this(ctx);
      auto self = ${getRequireFunctionName(typeInfo.name, module)}(ctx, -1);
      ${collectArgsIntoVariables(methodInfo, module)}
      ${doCall}
      ${doReturn(methodInfo.ret, module)}
    }

    `
}

function generateEnumPassingFunctions(info: EnumInfo, module: Module) {
  return fmtsrc`
    #define ${getPushFunctionName(info.name, module)}(ctx, val) \\
      duk_push_number(ctx, static_cast<double>(val))
    #define ${getRequireFunctionName(info.name, module)}(ctx, idx) \\
      static_cast<${module.mapDecl(info.name)}>(duk_require_number(ctx, (idx)))
    `
}

export function binding(info: FileInfo, module: Module): string {
  const requireStructFunctions = info.structTypes.flatMap(struct =>
    generateStructRequireFunction(struct, module),
  )

  const pushStructFunctions = info.structTypes.flatMap(struct =>
    generateStructPushFunction(struct, module),
  )

  const classPassingFunctions = info.classTypes.flatMap(cls =>
    generateClassPassingFunctions(cls, module),
  )

  const wrapperFunctions = info.functions.flatMap(fn =>
    generateWrapperFunction(fn, module),
  )

  const methodWrappers = [...info.classTypes, ...info.interfaceTypes].flatMap(
    typeInfo =>
      typeInfo.methods.flatMap(method =>
        generateMethodWrapper(method, typeInfo, module),
      ),
  )

  const constructorWrappers = info.classTypes.flatMap(cls =>
    generateConstructorWrapper(cls, module),
  )

  const interfaceWrappers = info.interfaceTypes.flatMap(iface =>
    generateInterfaceWrapper(iface, module),
  )

  const addFunctionWrappers = info.functions.flatMap(
    fn => fmtsrc`
      duk_push_c_lightfunc(ctx, ${
        fn.cName
      }_wrapper, ${fn.args.length.toString()}, ${fn.args.length.toString()}, 0);
      duk_put_prop_string(ctx,-2, "${fn.tsName}");
      `,
  )

  const addClassConstructors = info.classTypes.flatMap(c => {
    let len = c.constructor.args.length.toString()
    return fmtsrc`
      duk_push_c_lightfunc(ctx, ${c.name}_constructor_wrapper, ${len}, ${len}, 0);
      duk_put_prop_literal(ctx, -2, "${c.name}");
      `
  })

  const addEnums = info.enumTypes.flatMap(e => {
    return fmtsrc`
      duk_push_object(ctx);
      ${e.values.flatMap(
        val => fmtsrc`
          duk_push_number(ctx, ${val.value.toString()});
          duk_put_prop_literal(ctx, -2, "${val.name}");
          `,
      )}
      duk_put_prop_literal(ctx, -2, "${e.name}");
      `
  })

  const forwardTypeDeclarations = [
    ...module.getExternalBoundTypes(),
    ...module.fileInfo.classTypes.map(info => info.name),
    ...module.fileInfo.interfaceTypes.map(info => info.name),
  ].flatMap(typeName => {
    return fmtsrc`
      void ${getPushFunctionName(
        typeName,
        module,
      )}(duk_context*, ${module.mapArg(typeName)});
      auto ${getRequireFunctionName(
        typeName,
        module,
      )}(duk_context*, int index) -> ${module.mapRet(typeName)};
      `
  })

  const forwardMethodWrapperDeclarations =
    module.fileInfo.interfaceTypes.flatMap(type => {
      let methods = type.methods.flatMap(
        method => fmtsrc`
          int ${type.name}_${method.cName}_method_wrapper(duk_context* ctx);
          `,
      )
      return fmtsrc`
        ${methods}
        `
    })

  const forwardFinalizerDeclarations = [
    ...module.fileInfo.classTypes,
    ...module.fileInfo.interfaceTypes,
  ].flatMap(type => `static int ${type.name}_finalizer(duk_context* ctx);`)

  const enumPassingFunctions = module.fileInfo.enumTypes.flatMap(enumType =>
    generateEnumPassingFunctions(enumType, module),
  )

  return fmtsrc`
    #include <duktape.h>
    using namespace ${info.modulePath.join('::')};

    static constexpr char native_obj_key[] = DUK_HIDDEN_SYMBOL("native_obj_key");

    // duktape support
    #define duk_push_string(ctx, str) duk_push_lstring(ctx, str.c_str(), str.size())
    static obol::ArrayBuffer duk_require_ArrayBuffer(duk_context* ctx, int index){
      obol::ArrayBuffer result;
      result.data = duk_require_buffer_data(ctx, index, &result.size);
      return result;
    }

    // forward declarations
    ${forwardTypeDeclarations}
    ${forwardMethodWrapperDeclarations}
    ${forwardFinalizerDeclarations}

    ${enumPassingFunctions}

    ${pushStructFunctions}

    ${requireStructFunctions}

    ${interfaceWrappers}

    ${wrapperFunctions}
    ${methodWrappers}
    ${constructorWrappers}

    ${classPassingFunctions}

    namespace ${info.modulePath.join('::')} {
      void create_module_object(duk_context* ctx){
        // create the module
        duk_push_object(ctx);
        // duk_push_true(ctx);
        // duk_put_prop_literal(ctx, -2, "__esModule");

        ${addFunctionWrappers}

        // constructor wrappers
        ${addClassConstructors}

        // enum values
        ${addEnums}
      }
    }
    `.join('\n')
}
