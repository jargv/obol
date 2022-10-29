#pragma once
#include <cstddef>

namespace obol {
  class ObjBase {
  public:
    virtual ~ObjBase(){};
  };
  struct ArrayBuffer {
    void* data;
    std::size_t size;
  };
}

