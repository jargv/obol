// Generated from file "test/math.d.ts", do not modify directly!
#pragma once

#include "./math.hpp"
#include <memory>
#include <cassert>
#include "./obol.hpp"
namespace math {
  enum class CoordinateSpace {
    Local = 0,
    Global = 1,
  };
  class Widget;
  struct Vec3;
  struct Vec3 {
    float x;
    float y;
    float z;
  };
  class Widget : public virtual obol::ObjBase {
  public:
    struct Self;

    Widget(double size);
    ~Widget();
    auto animate(double speed, bool ccw) -> bool;

    // for obol binding use only
    void** unsafe_get_binding_data(){ return &binding_data; }

    // used to access the internals from within the same module
    auto unsafe_get_self() -> Self* {return self.get(); }

  private:
    void* binding_data = nullptr;
    std::unique_ptr<Self> self;
  };
  void place_widget(math::CoordinateSpace space, math::Vec3 const& pos);
}
