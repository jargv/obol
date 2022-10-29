const { compile } = require('../dist/src/compile')
const fs = require('node:fs')

const modules = ['math']
const actualOutputDir = '/tmp/obol_test_output'
const expectedOutputDir = __dirname

describe('check all output files', () => {
  compile({
    srcDir: 'test',
    outDir: actualOutputDir,
    modules: modules.map(m => ({ name: m })),
  })

  for (let module of modules) {
    test(`module "${module}" header`, () => {
      expect(
        fs.readFileSync(`${expectedOutputDir}/${module}.hpp`, 'utf8'),
      ).toEqual(fs.readFileSync(`${actualOutputDir}/${module}.hpp`, 'utf8'))
    })

    test(`module "${module}" binding`, () => {
      expect(
        fs.readFileSync(`${expectedOutputDir}/${module}.binding.cpp`, 'utf8'),
      ).toEqual(
        fs.readFileSync(`${actualOutputDir}/${module}.binding.cpp`, 'utf8'),
      )
    })
  }
})
