import fs from 'node:fs'
import {
  FileInfo,
  FunctionInfo,
  MethodInfo,
  StructInfo,
  InterfaceInfo,
  ClassInfo,
  EnumInfo,
  EnumValue,
} from './InfoTypes'
import ts from 'typescript'
import { Module } from './Module'

const snakecase = (name: string) => {
  let result = name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  return result
}

export class UnsupportedError extends Error {
  constructor(node: ts.Node, msg: string) {
    let file = node.getSourceFile()
    let { line, character } = file.getLineAndCharacterOfPosition(node.pos)
    let location = `${file.fileName}:${line + 1}:${character + 1}`
    super(`${location}: unexpected ${ts.SyntaxKind[node.kind]}, ${msg}`)
  }
}

class InternalError extends Error {
  constructor() {
    super('Internal Error')
  }

  static assert(condition: boolean): asserts condition {
    if (!condition) {
      throw new InternalError()
    }
  }
}

export function parseFile(
  filename: string,
  moduleName: string,
  boundModules: Map<string, Module>,
): FileInfo {
  const sourceFile = ts.createSourceFile(
    filename,
    fs.readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )

  let functions: FunctionInfo[] = []
  let structTypes: StructInfo[] = []
  let interfaceTypes: InterfaceInfo[] = []
  let classTypes: ClassInfo[] = []
  let modulesOfImportedTypes = new Map<string, Module>()
  let localModuleAliases = new Map<string, Module>
  let enumTypes : EnumInfo[] = []

  sourceFile.forEachChild(child => {
    if (ts.isFunctionDeclaration(child)) {
      functions.push(collectFunctionInfo(child))
    } else if (ts.isTypeAliasDeclaration(child)) {
      structTypes.push(collectStructInfo(child))
    } else if (ts.isInterfaceDeclaration(child)) {
      interfaceTypes.push(collectClassOrInterfaceInfo(child))
    } else if (ts.isClassDeclaration(child)) {
      classTypes.push(collectClassOrInterfaceInfo(child))
    } else if (ts.isImportDeclaration(child)) {
      collectModulesForImportedTypes(
        child,
        modulesOfImportedTypes,
        localModuleAliases,
        boundModules,
      )
    } else if (ts.isEnumDeclaration(child)){
      enumTypes.push(collectEnumInfo(child))
    } else if (child.kind === ts.SyntaxKind.EndOfFileToken) {
      // do nothing
    } else {
      throw new UnsupportedError(child, 'not supported')
    }
  })

  return {
    modulePath: moduleName.split('/'),
    srcFileName: filename,
    localModuleAliases,
    modulesOfImportedTypes,
    functions,
    structTypes,
    interfaceTypes,
    classTypes,
    enumTypes,
  }
}

function collectEnumInfo(enumNode: ts.EnumDeclaration) : EnumInfo {
  let name = enumNode.name.getText() ?? null
  if (name === null){
    throw new UnsupportedError(enumNode, "anonymous enums are not supported")
  }

  let values : EnumValue[] = []
  let currentEnumValue = 0
  for (let member of enumNode.members) {
    let name = member.name.getText()

    if (member.initializer !== undefined){
      throw new UnsupportedError(member.initializer, "enum initializers are not supported")
    }

    let value = currentEnumValue;
    currentEnumValue += 1;

    values.push({
      name,
      value
    })
  }

  return {
    kind: 'enum',
    name,
    values,
  }
}

function collectModulesForImportedTypes(
  node: ts.ImportDeclaration,
  typesByModule: Map<string, Module>,
  localModuleAliases: Map<string, Module>,
  modulesByName: Map<string, Module>,
) {
  let path = node.moduleSpecifier.getText()
  if (path === '"obol"'){
    return
  }

  let moduleName = RegExp(`^["']\.?\./([^"']+)["']$`).exec(path)?.[1] ?? null

  if (moduleName === null && !path.startsWith("./")){
    throw new UnsupportedError(node, `only relative imports are supported, found ${path}`)
  }

  InternalError.assert(moduleName !== null)

  let importedModule = modulesByName.get(moduleName) ?? null

  if (importedModule === null) {
    throw new UnsupportedError(
      node,
      `only modules which are proccessed by obol can be imported` +
        `\n  import: ${moduleName}` +
        `\n  available: ${[...modulesByName.keys()].join(', ')}`,
    )
  }

  if (node.importClause === undefined) {
    throw new UnsupportedError(node, 'anonymous imports are not supported')
  }

  let bindings = node.importClause.namedBindings ?? null
  if (bindings === null) {
    return
  }

  if (ts.isNamedImports(bindings)) {
    for (let element of bindings.elements) {
      if (!ts.isImportSpecifier(element)) {
        throw new UnsupportedError(
          element,
          'only import specifiers are supported',
        )
      }

      let typeName = element.getText()
      typesByModule.set(typeName, importedModule)
    }
  } else if (ts.isNamespaceImport(bindings)) {
    let name = bindings.name.getText()
    localModuleAliases.set(name, importedModule)
    console.log(`aliasing ${name} to ${importedModule.moduleName}`);
  }
}

function collectFunctionInfo(
  node:
    | ts.FunctionDeclaration
    | ts.MethodSignature
    | ts.MethodDeclaration
    | ts.ConstructorDeclaration,
): FunctionInfo {
  InternalError.assert(
    node.name !== undefined || ts.isConstructorDeclaration(node),
  )
  let name = node.name?.getText() ?? ''
  let info: MethodInfo = {
    tsName: name,
    cName: snakecase(name),
    args: [],
    ret: node.type?.getText() ?? 'void',
    isStatic: false,
  }

  node.parameters.forEach(param => {
    if (param.type === undefined) {
      throw new UnsupportedError(param, 'types are required')
    }
    info.args.push({
      name: param.name.getText(),
      type: param.type.getText(),
    })
  })

  for (let mod of node.modifiers ?? []) {
    if (mod.kind === ts.SyntaxKind.StaticKeyword) {
      info.isStatic = true
      throw new UnsupportedError(mod, "static methods aren't supported")
    } else if (mod.kind === ts.SyntaxKind.ExportKeyword) {
      // do nothing, only TS cares about this
    } else {
      throw new UnsupportedError(mod, 'unsupported modifier')
    }
  }

  if (ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) {
  }

  return info
}

function collectStructInfo(node: ts.TypeAliasDeclaration): StructInfo {
  const type = node.type
  if (!ts.isTypeLiteralNode(type)) {
    throw new UnsupportedError(
      node,
      'only struct-style type aliases are supported',
    )
  }

  let name = node.name.getText()

  let fields = type.members.map(member => {
    if (!ts.isPropertySignature(member)) {
      throw new UnsupportedError(member, 'only property signatures allowed')
    }

    let name = member.name?.getText() ?? null
    let type = member.type?.getText() ?? null
    let isOptional = member.questionToken !== undefined

    if (name === null) {
      throw new UnsupportedError(member, 'all fields must have a name')
    }

    if (type === null) {
      throw new UnsupportedError(member, 'all fields must have a type')
    }

    return {
      tsName: name,
      cName: snakecase(name),
      type,
      isOptional,
    }
  })

  return { kind: 'struct', name, fields }
}

function collectClassOrInterfaceInfo(
  node: ts.InterfaceDeclaration,
): InterfaceInfo
function collectClassOrInterfaceInfo(node: ts.ClassDeclaration): ClassInfo
function collectClassOrInterfaceInfo(node: any): any {
  let kind = ts.isInterfaceDeclaration(node)
    ? ('interface' as const)
    : ('class' as const)
  let name = node.name?.getText() ?? null
  if (name === null) {
    throw new UnsupportedError(node, 'anonymous classes are not supported')
  }

  let constructor: FunctionInfo | null = null
  let methods: FunctionInfo[] = []

  for (let member of node.members) {
    if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
      methods.push(collectFunctionInfo(member))
    } else if (kind === 'class' && ts.isConstructorDeclaration(member)) {
      constructor = collectFunctionInfo(member)
    } else {
      throw new UnsupportedError(
        member,
        kind === 'interface'
          ? 'only methods are supported in interfaces'
          : 'only methods and constructors are supported in class declarations',
      )
    }
  }

  return {
    kind,
    name,
    methods,
    constructor:
      kind === 'class'
        ? constructor ?? {
            name: 'constructor',
            args: [],
            ret: 'void',
          }
        : undefined,
  }
}
