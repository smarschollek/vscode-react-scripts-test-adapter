import { TestDecoration } from "vscode-test-adapter-api";

class DecorationBuilder {
  public build(filename: string, result: string) : TestDecoration {
    const x = JSON.parse(result)
    const log = x.testResults[0].message
    const lines = log.split('\n')

    return {
        line: Number(this.findLineNumber(filename, lines)) - 1 ,
        message: this.joinErrorLines(lines),
        hover: log
      }
  }

  private joinErrorLines (lines: string[]) {
    const index = lines.findIndex(x=>x.includes('|'))
    const error = lines.slice(2,index-1)
    return error.join(' ')
  }
  
  private findLineNumber (fileName: string, lines : string[]) {
    const index = lines.findIndex(x=>x.includes(fileName + ':'))
    return lines[index].split(':')[1]
  }
}

export const decorationBuilder = new DecorationBuilder()