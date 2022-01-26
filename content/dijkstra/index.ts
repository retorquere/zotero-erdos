/* eslint-disable @typescript-eslint/no-empty-function */
declare const Components: any
Components.utils.import('resource://gre/modules/Services.jsm')

declare const Zotero: {
  Erdos: Erdos
  getActiveZoteroPane: () => any
  debug: (msg: string) => void
  Utilities: any
  Prefs: any
  File: any
  Promise: any
}

import type { ReportStep, Erdos } from '../zotero-erdos'

// eslint-disable-next-line @typescript-eslint/require-await
async function pick(title: string, mode: 'open' | 'save' | 'folder', filters?: [string, string][], suggestion?: string): Promise<string> {
  const fp = Components.classes['@mozilla.org/filepicker;1'].createInstance(Components.interfaces.nsIFilePicker)

  if (suggestion) fp.defaultString = suggestion

  mode = {
    open: Components.interfaces.nsIFilePicker.modeOpen,
    save: Components.interfaces.nsIFilePicker.modeSave,
    folder: Components.interfaces.nsIFilePicker.modeGetFolder,
  }[mode]

  fp.init(window, title, mode)

  for (const [label, ext] of (filters || [])) {
    fp.appendFilter(label, ext)
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return new Zotero.Promise(resolve => {
    fp.open(userChoice => {
      switch (userChoice) {
        case Components.interfaces.nsIFilePicker.returnOK:
        case Components.interfaces.nsIFilePicker.returnReplace:
          resolve(fp.file.path)
          break

        default: // aka returnCancel
          resolve('')
          break
      }
    })
  })
}

function debug(msg) {
  Zotero.debug(`Erdos: paths: ${msg}`)
}

function input(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement
}

class TreeView {
  public rowCount: number
  private rows: ReportStep[]
  private treebox: any

  constructor(paths: ReportStep[][]) {
    this.rows = []
    for (const path of paths) {
      if (this.rows.length) this.rows.push(null)
      this.rows.push(...path) // eslint-disable-line @typescript-eslint/no-unsafe-argument
    }
    this.rowCount = this.rows.length
  }

  public getCellText(row: number, column: { id: string }): string {
    return (this.rows[row]?.[column.id.replace('step.', '')] as string) || ''
  }

  public getCellValue(row: number, column: { id: string }): string {
    return (column.id === 'step.title' && this.rows[row]) ? JSON.stringify(this.rows[row]) : ''
  }

  public setTree(treebox) {
    this.treebox = treebox
  }

  public isContainer(_row) {
    return false
  }

  public isSeparator(row) {
    return !this.rows[row]
  }

  public isSorted() {
    return false
  }

  public getLevel(_row) {
    return 0
  }

  public getImageSrc(_row, _col) {
    return null
  }

  public getRowProperties(_row, _props) {
  }

  public getCellProperties(_row, _col, _props) {
  }

  public getColumnProperties(_colid, _col, _props) {
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function verify() {
  const status = {
    creator: { id: '', ok: false },
    cocreator: { id: '', ok: false },
  }
  for (const id of ['creator', 'cocreator']) {
    const name = input(id).value
    status[id].id = Zotero.Erdos.started && Zotero.Erdos.graph.findNode((node, attr) => node[0] === 'C' && attr.name === name)
    status[id].ok = status[id].id && (id === 'creator' || status.creator.id !== status.cocreator.id)
    input(`${id}_status`).value = status[id].ok ? '\u2705' : '\u274C'
  }
  input('search').disabled = !status.creator.ok || !status.cocreator.ok
  input('save').disabled = !Zotero.Erdos.graph
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function search() {
  const creator: string = input('creator').value
  const cocreator: string = input('cocreator').value

  const paths: ReportStep[][] = Zotero.Erdos.search(cocreator, creator)
  document.getElementById('notreachable').hidden = !!paths

  if (paths) (document.getElementById('paths') as unknown as any).view = new TreeView(paths)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function select(index) {
  const tree = document.getElementById('paths') as unknown as any
  const selected: string = tree.view.getCellValue(index, { id: 'step.title' }) as string
  if (!selected) return

  const step: ReportStep = JSON.parse(selected) as unknown as ReportStep
  const zp = Zotero.getActiveZoteroPane()
  if (zp) {
    zp.collectionsView.selectLibrary(step.libraryID)
    zp.selectItems([ step.itemID ])
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function toggleSearchMode() {
  Zotero.Prefs.set('erdos.lastname-search', !!input('lastname-search').checked)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function save() {
  const filename = await pick('Save as GML', 'save', [['GML', '.gml']])
  if (filename) Zotero.File.putContentsAsync(filename, Zotero.Erdos.gml())
}

window.addEventListener('load', () => {
  input('lastname-search').checked = !!Zotero.Prefs.get('erdos.lastname-search')
  debug('pane loaded')
  verify()
  Zotero.Erdos.event.on('graph.refresh', verify)
})
