export default (
  templates: TemplateStringsArray,
  ...args: (string | string[])[]
): string[] => {
  let lastTemplate = templates[templates.length - 1]
  let lastLines = lastTemplate.split('\n')
  let negativeIndent = lastLines.pop()?.length ?? 0

  let finalLines: string[] = []

  let prevWasString = false
  for (let i = 0; i < templates.length; i++) {
    let templateLines = templates[i].split('\n')
    let arg = args[i] ?? null

    if (prevWasString) {
      // previously we had a string, the first line should be added to it
      finalLines[finalLines.length - 1] += templateLines.shift()
    } else {
      // the newline after a set of lines isn't needed, nor is the first line in a template
      templateLines.shift()
    }

    if (typeof arg === 'string') {
      finalLines.push(...templateLines.map(l => l.slice(negativeIndent)))
      let line = finalLines.pop() + arg
      finalLines.push(line)
      prevWasString = true
    } else if (Array.isArray(arg)) {
      let indent = templateLines.pop()?.slice(negativeIndent) ?? ''
      finalLines.push(...templateLines.map(l => l.slice(negativeIndent)))
      // add the indent to each line, but not to empty lines
      finalLines.push(...arg.map(a => (a.length == 0 ? a : indent + a)))
      prevWasString = false
    } else {
      // at the end of the template, there isn't any arg to use and the last
      // line of the template is not needed
      templateLines.pop()
      finalLines.push(...templateLines.map(l => l.slice(negativeIndent)))
    }
  }

  return finalLines
}
