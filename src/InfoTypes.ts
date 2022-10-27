import { Module } from './Module'

export type FunctionInfo = {
  tsName: string
  cName: string
  args: { name: string; type: string }[]
  ret: string
}

export type MethodInfo = FunctionInfo & {
  isStatic: boolean
}

export type StructField = {
  tsName: string
  cName: string
  type: string
  isOptional: boolean
}

export type StructInfo = {
  kind: 'struct'
  name: string
  fields: StructField[]
}

export type InterfaceInfo = {
  kind: 'interface'
  name: string
  methods: MethodInfo[]
}

export type ClassInfo = {
  kind: 'class'
  name: string
  methods: MethodInfo[]
  constructor: FunctionInfo
}

export type EnumValue = {
  name: string
  value: number
}

export type EnumInfo = {
  kind: 'enum'
  name: string
  values: EnumValue[]
}

export type TypeInfo = StructInfo | InterfaceInfo | ClassInfo | EnumInfo

export type FileInfo = {
  modulePath: string[]
  srcFileName: string
  modulesOfImportedTypes: Map<string, Module>
  localModuleAliases: Map<string, Module>
  functions: FunctionInfo[]
  structTypes: StructInfo[]
  interfaceTypes: InterfaceInfo[]
  classTypes: ClassInfo[]
  enumTypes: EnumInfo[]
}
