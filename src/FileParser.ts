import { TestInfo, TestSuiteInfo } from "vscode-test-adapter-api";
import { DescribeBlock, ItBlock, parse, ParsedNode, ParsedNodeTypes } from "jest-editor-support";
import { Uri } from "vscode";

export default class FileParser {
  public parse(file: Uri) : (TestSuiteInfo | TestInfo)[] {
    const node = parse(file.fsPath)
    return this.parseChildren(node.root.children)
  }

  private parseChildren (children?: ParsedNode[], fullName?: string) : (TestSuiteInfo | TestInfo)[] {
    const result: (TestSuiteInfo | TestInfo)[] = []

    if(children) {
      for(const child of children) {
        
        if(child.type === ParsedNodeTypes.describe) {
          const node = child as DescribeBlock
          result.push({
            id: this.buildId(node.name, fullName),
            label: node.name,
            file: node.file,
            line: node.start.line - 1,
            type: 'suite',
            children: this.parseChildren(node.children, this.buildId(node.name, fullName))
          })
        }

        if(child.type === ParsedNodeTypes.it) {
          const node = child as ItBlock
          result.push({
            id: this.buildId(node.name, fullName),
            label: node.name,
            file: node.file,
            line: node.start.line - 1,
            type: 'test'
          })
        }
      }
    }

    return result;
  }

  private buildId(name: string, fullname?: string) : string {
    if(fullname) {
      return (fullname + ' ' + name).trim()
    }

    return name
  }
}