import { FileInfo, TypeInfo } from './InfoTypes'

export type GlobalTypeMapping = {
  tsType: string
  cppType: string
  tsAliasFor?: string
  cppHeader?: {
    path: string
    type: HeaderType
  }
}

enum TypeMappingKind {
  Arg,
  Ret,
  Decl,
}

type HeaderType = 'system' | 'relative'

export class Module {
  private headersNeeded = new Map<string, HeaderType>()
  private mappingsByTsType = new Map<string, GlobalTypeMapping>()
  private externalBoundTypes = new Set<string>()
  private typesByName = new Map<string, TypeInfo>()
  public fileInfo!: FileInfo

  constructor(public readonly moduleName: string) {}

  setFileInfo(fi: FileInfo) {
    this.fileInfo = fi
    ;[
      ...this.fileInfo.structTypes,
      ...this.fileInfo.interfaceTypes,
      ...this.fileInfo.classTypes,
      ...this.fileInfo.enumTypes,
    ].forEach(type => this.typesByName.set(type.name, type))
  }

  addMappings(mappings: GlobalTypeMapping[]) {
    for (let mapping of mappings) {
      this.mappingsByTsType.set(mapping.tsType, mapping)
    }
  }

  resolveModuleOfType(typeName: string): [module: Module | null, type: string] {
    // a globally mapped type
    let mapping = this.mappingsByTsType.get(typeName) ?? null
    if (mapping !== null) {
      return [null, mapping.cppType]
    }

    // a type from this module
    if (this.typesByName.has(typeName)) {
      return [this, typeName]
    }

    // aliased module, type looks like module.Type
    let dotIndex = typeName.indexOf('.')
    if (dotIndex !== -1) {
      let moduleName = typeName.slice(0, dotIndex)
      let resolvedTypeName = typeName.slice(dotIndex + 1)
      let module = this.fileInfo.localModuleAliases.get(moduleName) ?? null
      return [module, resolvedTypeName]
    }

    // type imported by name like: import {TypeName} from "./Module"
    let module = this.fileInfo.modulesOfImportedTypes.get(typeName) ?? null
    if (module) {
      return [module, typeName]
    }

    throw new Error(`Can't resolve type ${typeName}`)
  }

  private mapType(tsTypeName: string, mappingKind: TypeMappingKind) {
    let [module, resolvedTypeName] = this.resolveModuleOfType(tsTypeName)

    let result = tsTypeName

    if (module === null) {
      let mapping = this.mappingsByTsType.get(tsTypeName) ?? null
      if (mapping === null) {
        throw new Error(`Unresolved Type ${tsTypeName}`)
      }
      if (mapping.cppHeader !== undefined) {
        this.headersNeeded.set(mapping.cppHeader.path, mapping.cppHeader.type)
      }
      result = mapping.cppType
    } else {
      this.headersNeeded.set(`${module.moduleName}.hpp`, 'relative')
      result = `${module.fileInfo.modulePath.join('::')}::${resolvedTypeName}`
    }

    let typeInfo = module?.typesByName.get(resolvedTypeName)

    if (typeInfo?.kind === 'struct' && mappingKind === TypeMappingKind.Arg) {
      result = `${result} const&`
    } else if (typeInfo?.kind === 'interface' || typeInfo?.kind === 'class') {
      result = `std::shared_ptr<${result}>`
      this.headersNeeded.set('memory', 'system')
    }

    if (module !== null && module !== this) {
      this.externalBoundTypes.add(tsTypeName)
    }

    return result
  }

  mapDecl(tsTypeName: string): string {
    return this.mapType(tsTypeName, TypeMappingKind.Decl)
  }

  mapArg(tsTypeName: string): string {
    return this.mapType(tsTypeName, TypeMappingKind.Arg)
  }

  mapRet(tsTypeName: string): string {
    return this.mapType(tsTypeName, TypeMappingKind.Ret)
  }

  resolveTypeAlias(typeName: string) {
    let mapping = this.mappingsByTsType.get(typeName)
    return mapping?.tsAliasFor ?? typeName
  }

  requireHeader(name: string, type: HeaderType) {
    this.headersNeeded.set(name, type)
  }

  getHeaders(): [string, HeaderType][] {
    return [...this.headersNeeded.entries()]
  }

  getExternalBoundTypes(): string[] {
    return [...this.externalBoundTypes]
  }
}
