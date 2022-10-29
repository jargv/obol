import { GlobalTypeMapping } from './Module'

export const standardMappings: GlobalTypeMapping[] = [
  {
    tsType: 'number',
    cppType: 'double',
  },
  {
    tsType: 'num.i8',
    tsAliasFor: 'number',
    cppType: 'int32_t',
    cppHeader: { path: 'cstdint', type: 'system' },
  },
  {
    tsType: 'num.i16',
    tsAliasFor: 'number',
    cppType: 'int32_t',
    cppHeader: { path: 'cstdint', type: 'system' },
  },
  {
    tsType: 'num.i32',
    tsAliasFor: 'number',
    cppType: 'int32_t',
    cppHeader: { path: 'cstdint', type: 'system' },
  },
  {
    tsType: 'num.i64',
    tsAliasFor: 'BigInt',
    cppType: 'int64_t',
    cppHeader: { path: 'cstdint', type: 'system' },
  },
  {
    tsType: 'num.u8',
    tsAliasFor: 'number',
    cppType: 'uint32_t',
    cppHeader: { path: 'cstdint', type: 'system' },
  },
  {
    tsType: 'num.u16',
    tsAliasFor: 'number',
    cppType: 'uint32_t',
    cppHeader: { path: 'cstdint', type: 'system' },
  },
  {
    tsType: 'num.u32',
    tsAliasFor: 'number',
    cppType: 'uint32_t',
    cppHeader: { path: 'cstdint', type: 'system' },
  },
  {
    tsType: 'num.u64',
    tsAliasFor: 'BigInt',
    cppType: 'uint64_t',
    cppHeader: { path: 'cstdint', type: 'system' },
  },
  {
    tsType: 'num.f32',
    tsAliasFor: 'number',
    cppType: 'float',
  },
  {
    tsType: 'num.f64',
    tsAliasFor: 'number',
    cppType: 'double',
  },
  {
    tsType: 'void',
    cppType: 'void',
  },
  {
    tsType: 'boolean',
    cppType: 'bool',
  },
  {
    tsType: 'ArrayBuffer',
    cppType: 'obol::ArrayBuffer',
  },
  {
    tsType: 'string',

    cppType: 'std::string',
    cppHeader: { path: 'string', type: 'system' },
  },
]
