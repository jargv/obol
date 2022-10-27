import fs from 'node:fs'
import path from 'node:path'
import proc from 'node:process'

import * as parse from './parse'
import * as generate from './generate'
import fmtsrc from './fmtsrc'
import { Module } from './Module'

type Config = {
  srcDir?: string
  outDir?: string
  modules?: {
    name: string
  }[]
}

export function compile() {
  const dir = process.cwd()
  const pkgFile = `${dir}/package.json`
  const pkgContents = fs.readFileSync(pkgFile, 'utf8')
  const pkgJson = JSON.parse(pkgContents)

  const config = pkgJson.obol as Config

  const srcDir = config?.srcDir ?? '.'
  const outDir = config?.outDir ?? '.'
  const modules = config?.modules ?? []

  // copy support header
  fs.mkdirSync(outDir, { recursive: true })
  fs.copyFileSync(
    `${path.dirname(path.dirname(__dirname))}/supportFiles/obol.hpp`,
    `${outDir}/obol.hpp`,
  )

  try {
    let bindingModules = new Map<string, Module>()
    for (let { name } of modules) {
      bindingModules.set(name, new Module(name))
    }

    for (let { name } of modules) {
      const inFile = `${srcDir}/${name}.d.ts`
      const fileInfo = parse.parseFile(inFile, name, bindingModules)
      bindingModules.get(name)!.setFileInfo(fileInfo)
    }

    for (let { name } of modules) {
      const outHeader = `${outDir}/${name}.hpp`
      const outBinding = `${outDir}/${name}.binding.cpp`

      const module = bindingModules.get(name)!
      module.addMappings(
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
      )

      let headerContents = generate.header(module.fileInfo, module)
      let headerIncludes = generate.headerIncludes(module)
      let hpp = fmtsrc`
        // Generated from file "${module.fileInfo.srcFileName}", do not modify directly!
        #pragma once

        ${headerIncludes}
        ${headerContents}
        `.join('\n')
      fs.mkdirSync(path.dirname(outHeader), { recursive: true })
      fs.writeFileSync(outHeader, hpp, 'utf8')

      let bindingContents = generate.binding(module.fileInfo, module)
      let bindingIncludes = generate.headerIncludes(module)
      let binding = fmtsrc`
        // Generated from file "${
          module.fileInfo.srcFileName
        }", do not modify directly!
        #include "./${module.fileInfo.modulePath.at(-1) ?? ''}.hpp"
        ${bindingIncludes}
        ${bindingContents}
        `.join('\n')

      fs.mkdirSync(path.dirname(outBinding), { recursive: true })
      fs.writeFileSync(outBinding, binding, 'utf8')
    }
  } catch (error) {
    if (error instanceof parse.UnsupportedError) {
      console.log(error.message)
      proc.exit(1)
    } else {
      throw error
    }
  }
}
