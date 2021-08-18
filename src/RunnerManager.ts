import { TestInfo } from "vscode-test-adapter-api";
import * as settings from "./settings";

export interface IRunner {
  node: TestInfo,
  execute : () => Promise<void>
}

class RunnerManager {
  private readonly _maxParallelRunner = settings.getMaxTestRunner()
  private _activeRunner = 0
  private _runner: IRunner[] = []

  public onComplete? : () => void

  public addRunner = (runner: IRunner) => {
    this._runner.push(runner)
  }

  public start = () => {
    this.startRunnerLoop()
  }

  startRunnerLoop() {
    if(this._runner.length > 0) {
      while(this._activeRunner < this._maxParallelRunner) {
        ++this._activeRunner
        if(this._runner.length > 0) {
          const runner = this._runner.splice(0,1)[0]
          runner.execute().then(() => {
            --this._activeRunner
          })
        }
      }
    } 

    if(this._activeRunner === 0) {
      if(this.onComplete)  {
        this.onComplete()
      }
      
      return
    } 

    setTimeout(() => {
      this.startRunnerLoop()
    }, 1000)
  }
}

export const runnerManager = new RunnerManager()