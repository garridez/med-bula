import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { DateTime } from 'luxon'
import type Document from '#models/document'
import type Patient from '#models/patient'
import type User from '#models/user'
import type Clinic from '#models/clinic'
import type {
  PrescriptionItem,
  ExamItem,
  CertificatePayload,
} from '#models/document'
import { LOGO_PNG_BUFFER } from '#utils/logo'

export interface PdfContext {
  document: Document
  patient: Patient
  doctor: User
  clinic: Clinic
  /** URL pública pra QR code (baixa farmacêutica nas receitas) */
  publicUrl?: string
}

const COLOR_PRIMARY = '#e53935'
const BLACK = '#000000'
const COLOR_LINE = '#d1d5db'
const COLOR_STRIP_BG = '#f3f4f6'
const COLOR_AD_BG = '#fef2f2'

const PAGE_LEFT = 50
const PAGE_RIGHT = 545
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_LEFT

// Coordenadas fixas do footer — layout sempre amarrado nessas linhas pra
// nunca ter desalinhamento mesmo se o conteúdo crescer.
const FOOTER_TOP_Y = 680 // início da faixa cinza com info do médico
const FOOTER_STRIP_HEIGHT = 55
const SIGNATURE_LINE_Y = FOOTER_TOP_Y + FOOTER_STRIP_HEIGHT + 8 // 743
const AD_STRIP_Y = 760
const AD_STRIP_HEIGHT = 22
const ITEMS_MAX_Y = FOOTER_TOP_Y - 8 // 672 — a partir daqui addPage

export default class PdfService {
  async generate(ctx: PdfContext): Promise<Buffer> {
    switch (ctx.document.type) {
      case 'prescription':
        return this.generatePrescription(ctx)
      case 'exam_request':
        return this.generateExamRequest(ctx)
      case 'medical_certificate':
        return this.generateCertificate(ctx)
      default:
        throw new Error(`Tipo de documento desconhecido: ${ctx.document.type}`)
    }
  }

  // ========== Receita ==========
  private async generatePrescription(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)

    const items = ((ctx.document.payload as any)?.items ?? []) as PrescriptionItem[]
    const hasControlled = items.some((it) => it.controlled)
    const title = hasControlled ? 'RECEITA DE CONTROLE ESPECIAL' : 'RECEITUÁRIO MÉDICO'

    this.writeTitle(doc, title)
    this.writePatientBlock(doc, ctx.patient, ctx.document)

    if (items.length === 0) {
      doc.fontSize(9).fillColor(BLACK).font('Helvetica-Oblique')
      doc.text('(Nenhum medicamento prescrito)', PAGE_LEFT, doc.y)
    } else {
      for (let i = 0; i < items.length; i++) {
        this.writePrescriptionItem(doc, items[i], i + 1)
      }
    }

    await this.writeFooter(doc, ctx)
    return this.streamToBuffer(doc)
  }

  // ========== Pedido de exame ==========
  private async generateExamRequest(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)
    this.writeTitle(doc, 'PEDIDO DE EXAMES')
    this.writePatientBlock(doc, ctx.patient, ctx.document)

    const items = ((ctx.document.payload as any)?.items ?? []) as ExamItem[]
    doc.fontSize(9).fillColor(BLACK).font('Helvetica-Bold')
    doc.text('Solicito:', PAGE_LEFT, doc.y)
    doc.moveDown(0.3)

    if (items.length === 0) {
      doc.font('Helvetica-Oblique').text('(Nenhum exame solicitado)')
    } else {
      doc.font('Helvetica').fontSize(9.5)
      items.forEach((item, idx) => {
        if (doc.y > ITEMS_MAX_Y) doc.addPage()
        doc.text(`${idx + 1}. ${item.name}`, PAGE_LEFT, doc.y)
        if (item.tuss) {
          doc.fontSize(8).fillColor(BLACK).font('Helvetica')
          doc.text(`TUSS: ${item.tuss}`, PAGE_LEFT + 16, doc.y)
          doc.fontSize(9.5)
        }
        if (item.notes) {
          doc.fontSize(8).text(item.notes, PAGE_LEFT + 16, doc.y, {
            width: CONTENT_WIDTH - 16,
          })
          doc.fontSize(9.5)
        }
        doc.moveDown(0.25)
      })
    }

    await this.writeFooter(doc, ctx)
    return this.streamToBuffer(doc)
  }

  // ========== Atestado ==========
  private async generateCertificate(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)
    this.writeTitle(doc, 'ATESTADO MÉDICO')
    this.writePatientBlock(doc, ctx.patient, ctx.document)

    const payload = (ctx.document.payload ?? {}) as CertificatePayload
    const days = payload.daysOff ?? 1
    const reason = payload.reason ?? 'tratamento de saúde'
    const issued = DateTime.fromISO(
      (ctx.document.createdAt ?? DateTime.now()).toString()
    )
      .setZone('America/Sao_Paulo')
      .setLocale('pt-BR')

    const text =
      `Atesto, para os devidos fins, que ${ctx.patient.fullName.toUpperCase()}` +
      (ctx.patient.cpf ? `, CPF ${ctx.patient.cpf}` : '') +
      `, esteve sob meus cuidados médicos no dia ${issued.toFormat("dd/LL/yyyy")}, ` +
      `necessitando afastamento de suas atividades por ${days} (${this.numberWord(days)}) dia(s), ` +
      `pelo motivo: ${reason}.`

    doc.fontSize(10).fillColor(BLACK).font('Helvetica')
    doc.text(text, PAGE_LEFT, doc.y, {
      width: CONTENT_WIDTH,
      align: 'justify',
      lineGap: 2,
    })

    if (payload.cid) {
      doc.moveDown(0.6)
      doc.font('Helvetica-Bold').text('CID: ', PAGE_LEFT, doc.y, { continued: true })
      doc.font('Helvetica').text(payload.cid)
    }
    if (payload.notes) {
      doc.moveDown(0.4)
      doc.fontSize(9).text(payload.notes, PAGE_LEFT, doc.y, { width: CONTENT_WIDTH })
    }

    doc.moveDown(1)
    const city = ctx.clinic.address?.split('-').pop()?.trim().split('/')[0] ?? ''
    doc
      .fontSize(10)
      .text(
        `${city ? city + ', ' : ''}${issued.toFormat("dd 'de' LLLL 'de' yyyy")}.`,
        PAGE_LEFT,
        doc.y,
        { width: CONTENT_WIDTH, align: 'right' }
      )

    await this.writeFooter(doc, ctx)
    return this.streamToBuffer(doc)
  }

  // ===========================================================
  // Helpers
  // ===========================================================

  private newDoc() {
    return new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 20, left: PAGE_LEFT, right: 50 },
      info: { Title: 'med.bula — Documento médico', Author: 'med.bula' },
    })
  }

  /**
   * Header compacto: logo pequena à esquerda + nome da clínica + sub-info
   * em uma linha abaixo. Tudo alinhado à esquerda. Sem centralização.
   */
  private writeHeader(doc: PDFKit.PDFDocument, clinic: Clinic) {
    try {
      doc.image(LOGO_PNG_BUFFER, PAGE_LEFT, 38, { width: 26 })
    } catch {
      /* ignore */
    }

    doc.fontSize(11).fillColor(BLACK).font('Helvetica-Bold')
    doc.text(clinic.name, PAGE_LEFT + 36, 40, { lineBreak: false })

    doc.fontSize(8).font('Helvetica')
    const sub: string[] = []
    if (clinic.address) sub.push(clinic.address)
    if (clinic.cnpj) sub.push(`CNPJ ${clinic.cnpj}`)
    if (clinic.phone) sub.push(clinic.phone)
    if (sub.length) {
      doc.text(sub.join(' · '), PAGE_LEFT + 36, 55, {
        width: CONTENT_WIDTH - 36,
        lineBreak: false,
        ellipsis: true,
      })
    }

    // Linha vermelha fina
    doc
      .strokeColor(COLOR_PRIMARY)
      .lineWidth(1.2)
      .moveTo(PAGE_LEFT, 78)
      .lineTo(PAGE_RIGHT, 78)
      .stroke()

    doc.x = PAGE_LEFT
    doc.y = 88
  }

  private writeTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(13).fillColor(BLACK).font('Helvetica-Bold')
    doc.text(title, PAGE_LEFT, 92, {
      width: CONTENT_WIDTH,
      align: 'left',
      characterSpacing: 1,
    })
    doc.x = PAGE_LEFT
    doc.y = 115
  }

  private writePatientBlock(
    doc: PDFKit.PDFDocument,
    patient: Patient,
    document: Document
  ) {
    const issued = DateTime.fromISO(
      (document.createdAt ?? DateTime.now()).toString()
    )
      .setZone('America/Sao_Paulo')
      .setLocale('pt-BR')
      .toFormat("dd/LL/yyyy 'às' HH:mm")

    // Nome do paciente
    doc.fontSize(9.5).fillColor(BLACK).font('Helvetica-Bold')
    doc.text('Paciente: ', PAGE_LEFT, 120, { continued: true })
    doc.font('Helvetica').text(patient.fullName)

    // CPF
    if (patient.cpf) {
      doc.font('Helvetica-Bold').text('CPF: ', PAGE_LEFT, doc.y, { continued: true })
      doc.font('Helvetica').text(patient.cpf)
    }

    // Emissão à direita do bloco do paciente
    doc.fontSize(9).font('Helvetica').fillColor(BLACK)
    doc.text(`Emissão: ${issued}`, PAGE_LEFT, 120, {
      width: CONTENT_WIDTH,
      align: 'right',
    })

    // Linha cinza fina separando paciente dos itens
    const sepY = Math.max(doc.y + 8, 158)
    doc
      .strokeColor(COLOR_LINE)
      .lineWidth(0.5)
      .moveTo(PAGE_LEFT, sepY)
      .lineTo(PAGE_RIGHT, sepY)
      .stroke()

    doc.x = PAGE_LEFT
    doc.y = sepY + 12
  }

  private writePrescriptionItem(
    doc: PDFKit.PDFDocument,
    item: PrescriptionItem,
    idx: number
  ) {
    // Reserva vertical estimada
    const linesNeeded = this.estimateItemLines(item)
    const itemHeight = 14 + linesNeeded * 11

    if (doc.y + itemHeight > ITEMS_MAX_Y) {
      doc.addPage()
      doc.y = 50
    }

    const startY = doc.y

    // Número à esquerda
    doc.fontSize(10).fillColor(BLACK).font('Helvetica-Bold')
    doc.text(`${idx}.`, PAGE_LEFT, startY, { width: 18, lineBreak: false })

    // Nome em maiúsculas
    doc.fontSize(10).fillColor(BLACK).font('Helvetica-Bold')
    doc.text(item.name.toUpperCase(), PAGE_LEFT + 18, startY, {
      width: CONTENT_WIDTH - 18,
    })

    let y = doc.y + 1

    const detailLine = (label: string, value: string | null | undefined) => {
      if (!value) return
      doc.fontSize(9).fillColor(BLACK).font('Helvetica-Bold')
      doc.text(`${label}: `, PAGE_LEFT + 18, y, { continued: true })
      doc.font('Helvetica').text(value)
      y = doc.y
    }

    detailLine('Dosagem', item.dose ?? null)
    detailLine('Via', item.route ?? null)
    detailLine('Posologia', item.frequency ?? null)
    detailLine('Duração', item.duration ?? null)

    if (item.notes) {
      doc.fontSize(8.5).fillColor(BLACK).font('Helvetica-Oblique')
      doc.text(item.notes, PAGE_LEFT + 18, y, { width: CONTENT_WIDTH - 18 })
      y = doc.y
    }

    doc.fillColor(BLACK).font('Helvetica')
    doc.x = PAGE_LEFT
    doc.y = y + 6
  }

  private estimateItemLines(item: PrescriptionItem): number {
    let n = 1 // nome
    if (item.dose) n++
    if (item.route) n++
    if (item.frequency) n++
    if (item.duration) n++
    if (item.notes) n += Math.max(1, Math.ceil((item.notes?.length ?? 0) / 90))
    return n
  }

  /**
   * Footer fixo (sempre na mesma posição da última página):
   *
   *   ┌─────────────────────────────────────────┐ y=720
   *   │ faixa cinza claro                       │
   *   │   Médico(a): NAME  CRM: X  UF: Y        │
   *   │   Endereço: ... Cidade: ... Tel: ...    │  + QR à direita
   *   └─────────────────────────────────────────┘ y=780
   *   "Assinado digitalmente por NAME CRM-UF"     y=788
   *   ┌─────────────────────────────────────────┐ y=805
   *   │ faixa rosa: bula.com.br tagline         │  y=830
   *   └─────────────────────────────────────────┘
   */
  private async writeFooter(doc: PDFKit.PDFDocument, ctx: PdfContext) {
    // Faixa cinza claro com info do médico
    doc
      .save()
      .fillColor(COLOR_STRIP_BG)
      .rect(PAGE_LEFT, FOOTER_TOP_Y, CONTENT_WIDTH, FOOTER_STRIP_HEIGHT)
      .fill()
      .restore()

    // Info do médico — esquerda
    const infoX = PAGE_LEFT + 10
    const infoTop = FOOTER_TOP_Y + 8
    let iy = infoTop

    const writeInfo = (label: string, value: string | null | undefined) => {
      if (!value) return
      doc.fontSize(8).fillColor(BLACK).font('Helvetica-Bold')
      doc.text(`${label}: `, infoX, iy, { continued: true })
      doc.font('Helvetica').text(value)
      iy = doc.y
    }

    const medicoLine = [
      ctx.doctor.fullName,
      ctx.doctor.crm ? `CRM: ${ctx.doctor.crm}` : null,
      ctx.doctor.crmUf ? `UF: ${ctx.doctor.crmUf}` : null,
    ]
      .filter(Boolean)
      .join('   ')
    writeInfo('Médico(a)', medicoLine)
    writeInfo('Especialidade', ctx.doctor.specialty ?? null)

    // QR code à direita — verticalmente centralizado na faixa
    if (ctx.publicUrl) {
      try {
        const qrDataUrl = await QRCode.toDataURL(ctx.publicUrl, {
          margin: 0,
          width: 120,
          color: { dark: BLACK, light: '#ffffff' },
        })
        const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')
        const qrSize = 50
        const qrX = PAGE_RIGHT - qrSize - 10
        const qrY = FOOTER_TOP_Y + (FOOTER_STRIP_HEIGHT - qrSize) / 2
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize })
      } catch {
        /* ignore */
      }
    }

    // Linha de assinatura digital — sempre mostra o assinante (iClinicRx style).
    // Se a assinatura Vidaas concluir, o PDF reader (Adobe, gov.br/assina) detecta
    // a assinatura cryptográfica embutida; senão, só fica o texto sem o crypto.
    const crmPart = ctx.doctor.crm
      ? ` · CRM ${ctx.doctor.crm}${ctx.doctor.crmUf ? '-' + ctx.doctor.crmUf : ''}`
      : ''
    const sigText = `Assinado digitalmente por ${ctx.doctor.fullName.toUpperCase()}${crmPart} · ICP-Brasil`
    doc.fontSize(7.5).fillColor(BLACK).font('Helvetica')
    doc.text(sigText, PAGE_LEFT, SIGNATURE_LINE_Y, {
      width: CONTENT_WIDTH,
      align: 'center',
    })

    // Faixa de propaganda bula.com.br — texto único sem split
    doc
      .save()
      .fillColor(COLOR_AD_BG)
      .rect(PAGE_LEFT, AD_STRIP_Y, CONTENT_WIDTH, AD_STRIP_HEIGHT)
      .fill()
      .restore()
    try {
      doc.image(LOGO_PNG_BUFFER, PAGE_LEFT + 8, AD_STRIP_Y + 4, { width: 14 })
    } catch {
      /* ignore */
    }
    doc.fontSize(7.5).fillColor(COLOR_PRIMARY).font('Helvetica-Bold')
    doc.text(
      'Em bula.com.br você recebe parte do dinheiro de volta na compra de medicamentos. Acesse!',
      PAGE_LEFT + 28,
      AD_STRIP_Y + 8,
      { width: CONTENT_WIDTH - 36 }
    )
  }

  private numberWord(n: number): string {
    const words: Record<number, string> = {
      1: 'um',
      2: 'dois',
      3: 'três',
      4: 'quatro',
      5: 'cinco',
      6: 'seis',
      7: 'sete',
      10: 'dez',
      14: 'quatorze',
      15: 'quinze',
      21: 'vinte e um',
      30: 'trinta',
    }
    return words[n] ?? String(n)
  }

  private streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      doc.end()
    })
  }
}
