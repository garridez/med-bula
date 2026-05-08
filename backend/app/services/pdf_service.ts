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
const COLOR_TEXT = '#1f2937'
const COLOR_MUTED = '#6b7280'
const COLOR_LIGHT_BG = '#fafafa'

const PAGE_LEFT = 50
const PAGE_RIGHT = 545
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_LEFT

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

  // ---------- Receita ----------
  private async generatePrescription(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)
    this.writeTitle(doc, 'RECEITUÁRIO MÉDICO', '01')
    this.writePatientBlock(doc, ctx.patient, ctx.document)

    const items = ((ctx.document.payload as any)?.items ?? []) as PrescriptionItem[]
    if (items.length === 0) {
      doc.fontSize(11).fillColor(COLOR_MUTED).text('(sem medicamentos)')
    } else {
      for (let idx = 0; idx < items.length; idx++) {
        if (doc.y > 640) doc.addPage()
        this.writePrescriptionItem(doc, items[idx], idx + 1)
      }
    }

    await this.writeReceitaFooter(doc, ctx)
    return this.streamToBuffer(doc)
  }

  // ---------- Pedido de exame ----------
  private async generateExamRequest(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)
    this.writeTitle(doc, 'PEDIDO DE EXAMES', '02')
    this.writePatientBlock(doc, ctx.patient, ctx.document)

    const items = ((ctx.document.payload as any)?.items ?? []) as ExamItem[]
    doc.fontSize(11).fillColor(COLOR_TEXT).font('Helvetica-Bold').text('Solicito:')
    doc.moveDown(0.4)

    if (items.length === 0) {
      doc.fontSize(11).fillColor(COLOR_MUTED).text('(sem exames)')
    } else {
      items.forEach((item, idx) => {
        if (doc.y > 720) doc.addPage()
        doc
          .fontSize(11)
          .fillColor(COLOR_TEXT)
          .font('Helvetica')
          .text(`${idx + 1}. ${item.name}`, { indent: 8 })
        if (item.tuss) {
          doc
            .fontSize(9)
            .fillColor(COLOR_MUTED)
            .text(`TUSS: ${item.tuss}`, { indent: 24 })
        }
        if (item.notes) {
          doc.fontSize(10).fillColor(COLOR_MUTED).text(item.notes, { indent: 24 })
        }
        doc.moveDown(0.3)
      })
    }

    this.writeStandardFooter(doc, ctx.doctor, ctx.document)
    return this.streamToBuffer(doc)
  }

  // ---------- Atestado ----------
  private async generateCertificate(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)
    this.writeTitle(doc, 'ATESTADO MÉDICO', '03')
    doc.moveDown(0.6)

    const payload = (ctx.document.payload ?? {}) as CertificatePayload
    const days = payload.daysOff ?? 1
    const reason = payload.reason ?? 'tratamento de saúde'
    const issuedDate = DateTime.fromISO(
      (ctx.document.createdAt ?? DateTime.now()).toString()
    )
      .setZone('America/Sao_Paulo')
      .setLocale('pt-BR')

    const fullText =
      `Atesto, para os devidos fins, que o(a) paciente ` +
      `${ctx.patient.fullName.toUpperCase()}` +
      (ctx.patient.cpf ? `, portador(a) do CPF ${ctx.patient.cpf}` : '') +
      `, esteve sob meus cuidados médicos no dia ${issuedDate.toFormat("dd 'de' LLLL 'de' yyyy")}, ` +
      `necessitando de afastamento de suas atividades habituais por ${days} (${this.numberWord(days)}) dia(s), ` +
      `pelo motivo: ${reason}.`

    doc
      .fontSize(11.5)
      .fillColor(COLOR_TEXT)
      .font('Helvetica')
      .text(fullText, { align: 'justify', lineGap: 4 })

    doc.moveDown(1)

    if (payload.cid) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`CID: `, { continued: true })
        .font('Helvetica')
        .text(payload.cid)
    }
    if (payload.notes) {
      doc.moveDown(0.5)
      doc.fontSize(10).fillColor(COLOR_MUTED).text(payload.notes)
    }

    doc.moveDown(2)
    const city = ctx.clinic.address?.split('-').pop()?.trim().split('/')[0] ?? ''
    doc
      .fontSize(11)
      .fillColor(COLOR_TEXT)
      .text(
        `${city ? city + ', ' : ''}${issuedDate.toFormat("dd 'de' LLLL 'de' yyyy")}.`,
        { align: 'right' }
      )

    this.writeStandardFooter(doc, ctx.doctor, ctx.document)
    return this.streamToBuffer(doc)
  }

  // ============================================================
  // Helpers comuns
  // ============================================================

  private newDoc() {
    return new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 90, left: PAGE_LEFT, right: 50 },
      info: {
        Title: 'med.bula — Documento médico',
        Author: 'med.bula',
      },
    })
  }

  private writeHeader(doc: PDFKit.PDFDocument, clinic: Clinic) {
    // Logo bula no canto esquerdo
    try {
      doc.image(LOGO_PNG_BUFFER, PAGE_LEFT, 40, { width: 36 })
    } catch {
      /* ignore */
    }

    // Texto da clínica centralizado
    const startY = 45
    doc
      .fontSize(13)
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica-Bold')
      .text(clinic.name, PAGE_LEFT + 50, startY, {
        align: 'center',
        width: CONTENT_WIDTH - 50,
      })

    doc
      .fillColor(COLOR_MUTED)
      .fontSize(9)
      .font('Helvetica')

    if (clinic.address) {
      doc.text(clinic.address, PAGE_LEFT + 50, doc.y, {
        align: 'center',
        width: CONTENT_WIDTH - 50,
      })
    }

    const meta: string[] = []
    if (clinic.cnpj) meta.push(`CNPJ ${clinic.cnpj}`)
    if (clinic.phone) meta.push(clinic.phone)
    if (meta.length) {
      doc.text(meta.join('   ·   '), PAGE_LEFT + 50, doc.y, {
        align: 'center',
        width: CONTENT_WIDTH - 50,
      })
    }

    // Linha vermelha
    const lineY = Math.max(doc.y + 8, 95)
    doc
      .strokeColor(COLOR_PRIMARY)
      .lineWidth(2)
      .moveTo(PAGE_LEFT, lineY)
      .lineTo(PAGE_RIGHT, lineY)
      .stroke()

    doc.x = PAGE_LEFT
    doc.y = lineY + 15
  }

  private writeTitle(doc: PDFKit.PDFDocument, title: string, prefix: string) {
    doc
      .fontSize(16)
      .fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .text(title, { align: 'center', characterSpacing: 1 })
    void prefix
    doc.moveDown(0.8)
  }

  private writePatientBlock(
    doc: PDFKit.PDFDocument,
    patient: Patient,
    document: Document
  ) {
    const issued = DateTime.fromISO((document.createdAt ?? DateTime.now()).toString())
      .setZone('America/Sao_Paulo')
      .setLocale('pt-BR')
      .toFormat("dd/MM/yyyy 'às' HH:mm")

    // Bloco com fundo cinza claro
    const blockTop = doc.y
    const blockHeight = patient.cpf ? 56 : 42
    doc
      .save()
      .fillColor(COLOR_LIGHT_BG)
      .roundedRect(PAGE_LEFT, blockTop, CONTENT_WIDTH, blockHeight, 4)
      .fill()
      .restore()

    let y = blockTop + 8
    doc.fontSize(9).fillColor(COLOR_MUTED).font('Helvetica-Bold')
    doc.text('PACIENTE', PAGE_LEFT + 12, y)
    doc.font('Helvetica').fillColor(COLOR_TEXT).fontSize(11)
    doc.text(patient.fullName, PAGE_LEFT + 12, y + 11)

    if (patient.cpf) {
      y += 28
      doc.fontSize(9).fillColor(COLOR_MUTED).font('Helvetica-Bold')
      doc.text('CPF', PAGE_LEFT + 12, y)
      doc.text('EMITIDO', PAGE_LEFT + 220, y)
      doc.font('Helvetica').fillColor(COLOR_TEXT).fontSize(10.5)
      doc.text(patient.cpf, PAGE_LEFT + 12, y + 11)
      doc.text(issued, PAGE_LEFT + 220, y + 11)
    } else {
      doc.fontSize(9).fillColor(COLOR_MUTED).font('Helvetica-Bold')
      doc.text('EMITIDO', PAGE_LEFT + 220, blockTop + 8)
      doc.font('Helvetica').fillColor(COLOR_TEXT).fontSize(10.5)
      doc.text(issued, PAGE_LEFT + 220, blockTop + 19)
    }

    doc.x = PAGE_LEFT
    doc.y = blockTop + blockHeight + 14
    doc.fillColor(COLOR_TEXT)
  }

  private writePrescriptionItem(
    doc: PDFKit.PDFDocument,
    item: PrescriptionItem,
    idx: number
  ) {
    const startY = doc.y
    const linesNeeded = this.estimatePrescriptionItemLines(item)
    const itemHeight = Math.max(38, 18 + linesNeeded * 14)

    // Zebra background pra item ímpar
    if (idx % 2 === 1) {
      doc
        .save()
        .fillColor(COLOR_LIGHT_BG)
        .roundedRect(PAGE_LEFT - 4, startY - 4, CONTENT_WIDTH + 8, itemHeight + 4, 4)
        .fill()
        .restore()
    }

    // Número circulado
    doc
      .save()
      .fillColor(COLOR_PRIMARY)
      .circle(PAGE_LEFT + 8, startY + 8, 9)
      .fill()
      .restore()
    doc
      .fontSize(10)
      .fillColor('white')
      .font('Helvetica-Bold')
      .text(String(idx), PAGE_LEFT + 4, startY + 4, { width: 10, align: 'center' })

    // Nome do medicamento
    doc
      .fontSize(12)
      .fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .text(item.name, PAGE_LEFT + 26, startY + 2)

    doc.fontSize(10).font('Helvetica').fillColor(COLOR_TEXT)
    let y = doc.y + 2

    const detail = (label: string, value: string | null | undefined) => {
      if (!value) return
      doc.fontSize(9).fillColor(COLOR_MUTED).font('Helvetica-Bold')
      doc.text(label, PAGE_LEFT + 26, y, { continued: true })
      doc.font('Helvetica').fontSize(10).fillColor(COLOR_TEXT)
      doc.text(' ' + value)
      y = doc.y + 1
    }

    detail('Dosagem', item.dose ?? null)
    detail('Via', item.route ?? null)
    detail('Posologia', item.frequency ?? null)
    detail('Duração', item.duration ?? null)
    if (item.notes) {
      doc.fontSize(9).fillColor(COLOR_MUTED).font('Helvetica-Italic')
      doc.text(item.notes, PAGE_LEFT + 26, y, { width: CONTENT_WIDTH - 30 })
      y = doc.y
    }

    if (item.controlled) {
      doc
        .fontSize(9)
        .fillColor(COLOR_PRIMARY)
        .font('Helvetica-Bold')
        .text('⚠  Medicamento controlado — uso conforme legislação', PAGE_LEFT + 26, y + 2)
    }

    doc.fillColor(COLOR_TEXT).font('Helvetica')
    doc.x = PAGE_LEFT
    doc.y = startY + itemHeight + 4
  }

  private estimatePrescriptionItemLines(item: PrescriptionItem): number {
    let n = 1 // nome
    if (item.dose) n++
    if (item.route) n++
    if (item.frequency) n++
    if (item.duration) n++
    if (item.notes) n += Math.ceil((item.notes?.length ?? 0) / 80) || 1
    if (item.controlled) n++
    return n
  }

  /**
   * Footer especial da receita: assinatura do médico + QR de baixa farmacêutica
   * + propaganda bula.com.br.
   */
  private async writeReceitaFooter(doc: PDFKit.PDFDocument, ctx: PdfContext) {
    if (doc.y > 660) doc.addPage()

    // posição fixa pro footer da receita: a partir de 670
    const footerY = Math.max(doc.y + 30, 670)

    // ----- Coluna esquerda: assinatura -----
    const sigX1 = PAGE_LEFT
    const sigX2 = PAGE_LEFT + 280
    doc
      .strokeColor(COLOR_TEXT)
      .lineWidth(0.7)
      .moveTo(sigX1, footerY)
      .lineTo(sigX2, footerY)
      .stroke()

    doc
      .fontSize(11)
      .fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .text(ctx.doctor.fullName, sigX1, footerY + 6, {
        width: sigX2 - sigX1,
        align: 'center',
      })

    const crmLine = `CRM/${ctx.doctor.crmUf ?? '--'} ${ctx.doctor.crm ?? '------'}`
    doc.fontSize(10).font('Helvetica').text(crmLine, sigX1, doc.y, {
      width: sigX2 - sigX1,
      align: 'center',
    })

    if (ctx.doctor.specialty) {
      doc
        .fontSize(9)
        .fillColor(COLOR_MUTED)
        .text(ctx.doctor.specialty, sigX1, doc.y, {
          width: sigX2 - sigX1,
          align: 'center',
        })
    }

    // ----- Coluna direita: QR code -----
    const qrX = PAGE_RIGHT - 80
    const qrY = footerY - 30
    if (ctx.publicUrl) {
      try {
        const qrDataUrl = await QRCode.toDataURL(ctx.publicUrl, {
          margin: 0,
          width: 150,
          color: { dark: COLOR_TEXT, light: '#ffffff' },
        })
        const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')
        doc.image(qrBuffer, qrX, qrY, { width: 80, height: 80 })
      } catch {
        // ignora se QR falhar
      }
    }

    doc
      .fontSize(7)
      .fillColor(COLOR_MUTED)
      .font('Helvetica')
      .text('Escaneie pra ver e baixar', qrX - 10, qrY + 82, {
        width: 100,
        align: 'center',
      })

    // ----- Faixa inferior bula.com.br -----
    const adY = 760
    doc
      .save()
      .fillColor('#fef2f2')
      .roundedRect(PAGE_LEFT, adY, CONTENT_WIDTH, 30, 4)
      .fill()
      .restore()

    // logo mini à esquerda da faixa
    try {
      doc.image(LOGO_PNG_BUFFER, PAGE_LEFT + 8, adY + 6, { width: 18 })
    } catch {
      /* ignore */
    }
    doc
      .fontSize(9)
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica-Bold')
      .text(
        'Em bula.com.br você recebe parte do seu dinheiro de volta na compra de medicamentos.',
        PAGE_LEFT + 32,
        adY + 7,
        { width: CONTENT_WIDTH - 90 }
      )
    doc
      .fontSize(8)
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica')
      .text('Acesse  →', PAGE_RIGHT - 60, adY + 11, { width: 50, align: 'right' })

    // Pé de página com status de assinatura
    const status =
      ctx.document.status === 'signed'
        ? 'Documento assinado digitalmente — ICP-Brasil'
        : 'Aguardando assinatura digital — ICP-Brasil'
    doc
      .fontSize(7)
      .fillColor(COLOR_MUTED)
      .text(`med.bula — ${status} — id: ${ctx.document.id}`, PAGE_LEFT, 798, {
        width: CONTENT_WIDTH,
        align: 'center',
      })
  }

  /**
   * Footer padrão (exame, atestado): só assinatura.
   */
  private writeStandardFooter(
    doc: PDFKit.PDFDocument,
    doctor: User,
    document: Document
  ) {
    if (doc.y > 700) doc.addPage()
    doc.moveDown(3)

    const sigY = doc.y
    doc
      .strokeColor(COLOR_TEXT)
      .lineWidth(0.7)
      .moveTo(180, sigY)
      .lineTo(415, sigY)
      .stroke()

    doc.moveDown(0.4)
    doc
      .fontSize(11)
      .fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .text(doctor.fullName, { align: 'center' })

    const crmLine = `CRM/${doctor.crmUf ?? '--'} ${doctor.crm ?? '------'}`
    doc.fontSize(10).font('Helvetica').text(crmLine, { align: 'center' })
    if (doctor.specialty) {
      doc.fontSize(9).fillColor(COLOR_MUTED).text(doctor.specialty, { align: 'center' })
    }

    const status =
      document.status === 'signed'
        ? 'Documento assinado digitalmente — ICP-Brasil'
        : 'Aguardando assinatura digital — ICP-Brasil'
    doc
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(`med.bula — ${status} — id: ${document.id}`, PAGE_LEFT, 800, {
        width: CONTENT_WIDTH,
        align: 'center',
      })
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
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      doc.end()
    })
  }
}
