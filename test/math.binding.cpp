// Generated from file "test/math.d.ts", do not modify directly!
#include "./math.hpp"
#include "./math.hpp"
#include <memory>
#include <cassert>
#include "./obol.hpp"
#include <duktape.h>
using namespace math;

static constexpr char native_obj_key[] = DUK_HIDDEN_SYMBOL("native_obj_key");

// duktape support
#define duk_push_string(ctx, str) duk_push_lstring(ctx, str.c_str(), str.size())
static obol::ArrayBuffer duk_require_ArrayBuffer(duk_context* ctx, int index){
  obol::ArrayBuffer result;
  result.data = duk_require_buffer_data(ctx, index, &result.size);
  return result;
}

// forward declarations
void duk_push_math_Widget(duk_context*, std::shared_ptr<math::Widget>);
auto duk_require_math_Widget(duk_context*, int index) -> std::shared_ptr<math::Widget>;
static int Widget_finalizer(duk_context* ctx);

#define duk_push_math_CoordinateSpace(ctx, val) \
  duk_push_number(ctx, static_cast<double>(val))
#define duk_require_math_CoordinateSpace(ctx, idx) \
  static_cast<math::CoordinateSpace>(duk_require_number(ctx, (idx)))

void duk_push_math_Vec3(duk_context* ctx, Vec3 const& val){
  // leave space for the object and each field
  duk_require_stack(ctx, 2);
  duk_push_object(ctx);

  duk_push_number(ctx, val.x);
  duk_put_prop_literal(ctx, -2, "x");

  duk_push_number(ctx, val.y);
  duk_put_prop_literal(ctx, -2, "y");

  duk_push_number(ctx, val.z);
  duk_put_prop_literal(ctx, -2, "z");

}


Vec3 duk_require_math_Vec3(duk_context* ctx, int index){
  // leave space for each field to be accessed
  duk_require_stack(ctx, 1);

  Vec3 result = {};
  // x
  duk_get_prop_literal(ctx, index, "x");
  result.x = duk_require_number(ctx, -1);
  duk_pop(ctx);
  // y
  duk_get_prop_literal(ctx, index, "y");
  result.y = duk_require_number(ctx, -1);
  duk_pop(ctx);
  // z
  duk_get_prop_literal(ctx, index, "z");
  result.z = duk_require_number(ctx, -1);
  duk_pop(ctx);

  return result;
}



int place_widget_wrapper(duk_context* ctx){
  auto arg0 = duk_require_math_CoordinateSpace(ctx, 0);
  auto arg1 = duk_require_math_Vec3(ctx, 1);
  place_widget(arg0, arg1);
  return 0;
}
int Widget_animate_method_wrapper(duk_context* ctx){
  duk_push_this(ctx);
  auto self = duk_require_math_Widget(ctx, -1);
  auto arg0 = duk_require_number(ctx, 0);
  auto arg1 = duk_require_boolean(ctx, 1);
  auto ret = self->animate(arg0, arg1);
  duk_require_stack(ctx, 1);
  duk_push_boolean(ctx, ret);
  return 1;
}

int Widget_constructor_wrapper(duk_context* ctx){
  auto arg0 = duk_require_number(ctx, 0);
  auto ret = std::make_shared<Widget>(arg0);
  duk_require_stack(ctx, 1);
  duk_push_math_Widget(ctx, ret);
  return 1;
}

struct math_Widget_binding_data {
  std::shared_ptr<Widget> self_ref;
  std::shared_ptr<obol::ObjBase> self_obj_ptr;
  void* js_heapptr = nullptr;
  static constexpr char const wrapper_key[] =
    DUK_HIDDEN_SYMBOL("Widget_wrapper_key")
  ;
};
static int Widget_finalizer(duk_context* ctx) {
  duk_require_object(ctx, -1);
  duk_get_prop_literal(ctx, -1, math_Widget_binding_data::wrapper_key);
  void* val_ptr = duk_require_pointer(ctx, -1);
  math_Widget_binding_data* binding = reinterpret_cast<math_Widget_binding_data*>(val_ptr);
  assert(*binding->self_ref->unsafe_get_binding_data() == binding);
  *binding->self_ref->unsafe_get_binding_data() = nullptr;
  binding->~math_Widget_binding_data();
  duk_free(ctx, binding);
  return 0;
}
void duk_push_math_Widget(duk_context* ctx, std::shared_ptr<Widget> val){
  // leave space for the object and each field
  duk_require_stack(ctx, 3);

  auto binding_data = static_cast<math_Widget_binding_data*>(*val->unsafe_get_binding_data());
  if (binding_data == nullptr){
    // create the wrapper object, leave it on the stack for return
    duk_push_object(ctx);

    // set the finalizer
    duk_push_c_lightfunc(ctx, Widget_finalizer, 1, 1, 0);
    duk_set_finalizer(ctx, -2);

    // set the prototype which is stored in the global stash
    duk_push_global_stash(ctx);
    duk_get_prop_literal(ctx, -1, math_Widget_binding_data::wrapper_key);
    if(!duk_is_object(ctx, -1)){
      duk_pop(ctx); // the undefined
      duk_push_global_stash(ctx);
      duk_push_object(ctx); // the new prototype
      duk_dup_top(ctx); // add a referenced to leave on the stack
      duk_push_c_lightfunc(ctx, Widget_animate_method_wrapper, 2, 2, 0);
      duk_put_prop_literal(ctx, -2, "animate");
      duk_put_prop_literal(ctx, -3, math_Widget_binding_data::wrapper_key); // assign the prototype into the stash
      duk_swap(ctx, -1, -2); // the stash and the prototype
      duk_pop(ctx); // pop the stash
    }
    duk_set_prototype(ctx, -3);
    duk_pop(ctx); // pop the stash

    // set up the binding data
    binding_data = static_cast<math_Widget_binding_data*>(
      duk_alloc(ctx, sizeof(math_Widget_binding_data))
    );
    new (binding_data) math_Widget_binding_data();
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
    duk_put_prop_literal(ctx, -2, math_Widget_binding_data::wrapper_key);
  } else {
    // push the object we already know about
    duk_push_heapptr(ctx, binding_data->js_heapptr);
  }
}

auto duk_require_math_Widget(duk_context* ctx, int index) -> std::shared_ptr<Widget> {
  duk_require_stack(ctx, 2);
  duk_require_object(ctx, index);
  duk_get_prop_literal(ctx, index, math_Widget_binding_data::wrapper_key);
  void* val_ptr = duk_require_pointer(ctx, -1);
  math_Widget_binding_data* binding = static_cast<math_Widget_binding_data*>(val_ptr);
  assert(binding);
  auto res = binding->self_ref;
  duk_pop(ctx); // pop the ptr
  return res;
}

namespace math {
  void create_module_object(duk_context* ctx){
    // create the module
    duk_push_object(ctx);
    // duk_push_true(ctx);
    // duk_put_prop_literal(ctx, -2, "__esModule");

    duk_push_c_lightfunc(ctx, place_widget_wrapper, 2, 2, 0);
    duk_put_prop_string(ctx,-2, "placeWidget");

    // constructor wrappers
    duk_push_c_lightfunc(ctx, Widget_constructor_wrapper, 1, 1, 0);
    duk_put_prop_literal(ctx, -2, "Widget");

    // enum values
    duk_push_object(ctx);
    duk_push_number(ctx, 0);
    duk_put_prop_literal(ctx, -2, "Local");
    duk_push_number(ctx, 1);
    duk_put_prop_literal(ctx, -2, "Global");
    duk_put_prop_literal(ctx, -2, "CoordinateSpace");
  }
}
