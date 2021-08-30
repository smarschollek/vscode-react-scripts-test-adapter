import { EventEmitter } from "vscode";
import * as settings from "./settings";

export interface IRunner {
  execute : () => Promise<void>
  cancel : () => void
}

export default class RunnerManager {
  private readonly maxParallelRunner = settings.getMaxTestRunner()
  private activeRunner: IRunner[] = []
  private runner: IRunner[] = []
  private onCompleteEmitter : EventEmitter<void> = new EventEmitter<void>()



  public get onComplete() { return this.onCompleteEmitter.event }

  public addRunner(runner: IRunner) {
    this.runner.push(runner)
  }

  public start() {
    this.startRunnerLoop()
  }

  public cancel() {
    this.activeRunner.forEach(x => x.cancel())
    this.activeRunner = []
  }

  private startRunnerLoop() {
    while(this.activeRunner.length < this.maxParallelRunner && this.runner.length > 0) {
      
      if(this.runner.length > 0) {
        const runner = this.runner.splice(0,1)[0]
        this.activeRunner.push(runner)
        runner.execute().then(() => {
          const index = this.activeRunner.findIndex(x => x === runner)
          if(index !== -1) {
            this.activeRunner.splice(index, 1)
          }
        })
      }
    }

    if(this.activeRunner.length === 0) {
      this.onCompleteEmitter.fire()      
      return
    } 

    setTimeout(() => {
      this.startRunnerLoop()
    }, 1000)
  }
}