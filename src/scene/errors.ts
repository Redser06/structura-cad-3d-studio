export class SceneImportError extends Error {
  readonly issues: string[]

  constructor(message: string, issues: string[] = [message]) {
    super(message)
    this.name = 'SceneImportError'
    this.issues = issues
  }
}
