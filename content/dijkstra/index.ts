/* eslint-disable @typescript-eslint/no-empty-function */
declare const Components: any
Components.utils.import('resource://gre/modules/Services.jsm')

import type { ReportStep, Erdos } from '../zotero-erdos'

declare const Zotero: {
  Erdos: Erdos
  getActiveZoteroPane: () => any
  debug: (msg: string) => void
  Utilities: any
}

function debug(msg) {
  Zotero.debug(`Erdos: paths: ${msg}`)
}

function input(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement
}

function reset() {
  input('creator').value = ''
  input('creator_status').value = ''
  input('cocreator').value = ''
  input('cocreator_status').value = ''
  input('search').disabled = true
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
    status[id].id = Zotero.Erdos.started && Zotero.Erdos.creators.byName[input(id).value]
    status[id].ok = status[id].id && (id === 'creator' || status.creator.id !== status.cocreator.id)
    input(`${id}_status`).value = status[id].ok ? '\u2705' : '\u274C'
  }
  input('search').disabled = !status.creator.ok || !status.cocreator.ok
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function search() {
  const creator: string = input('creator').value
  const cocreator: string = input('cocreator').value

  const paths = await Zotero.Erdos.search(cocreator, creator)
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

window.addEventListener('load', () => {
  debug('pane loaded')
  reset()
  Zotero.Erdos.event.on('graph.refresh', reset)
})
