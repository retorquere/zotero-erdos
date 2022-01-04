declare const Zotero: any
// declare const Components: any

if (!Zotero.Erdos) {
  const monkey_patch_marker = 'ErdosMonkeyPatched'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-inner-declarations, prefer-arrow/prefer-arrow-functions
  function patch(object, method, patcher) {
    if (object[method][monkey_patch_marker]) return
    object[method] = patcher(object[method])
    object[method][monkey_patch_marker] = true
  }

  class Erdos { // tslint:disable-line:variable-name
    private initialized = false
    private globals: Record<string, any>
    private strings: any

    // eslint-disable-next-line @typescript-eslint/require-await
    public async load(globals: Record<string, any>) {
      this.globals = globals

      if (this.initialized) return
      this.initialized = true

      this.strings = globals.document.getElementById('zotero-erdos-strings')
    }
  }

  Zotero.Erdos = new Erdos
}
