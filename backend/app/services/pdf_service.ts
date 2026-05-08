import PDFDocument from 'pdfkit'
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

export interface PdfContext {
  document: Document
  patient: Patient
  doctor: User
  clinic: Clinic
}

const COLOR_PRIMARY = '#e53935'
const COLOR_TEXT = '#1f2937'
const COLOR_MUTED = '#6b7280'
const COLOR_BORDER = '#e5e7eb'

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

  // --- public generators ---

  private async generatePrescription(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)
    this.writeTitle(doc, 'RECEITUÁRIO MÉDICO')
    this.writePatientBlock(doc, ctx.patient, ctx.document)

    const items = ((ctx.document.payload as any)?.items ?? []) as PrescriptionItem[]
    if (items.length === 0) {
      doc.fontSize(11).fillColor(COLOR_MUTED).text('(sem medicamentos)')
    } else {
      items.forEach((item, idx) => {
        if (doc.y > 680) doc.addPage()
        this.writePrescriptionItem(doc, item, idx + 1)
      })
    }

    this.writeFooter(doc, ctx.doctor, ctx.document)
    return this.streamToBuffer(doc)
  }

  private async generateExamRequest(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)
    this.writeTitle(doc, 'PEDIDO DE EXAMES')
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

    this.writeFooter(doc, ctx.doctor, ctx.document)
    return this.streamToBuffer(doc)
  }

  private async generateCertificate(ctx: PdfContext): Promise<Buffer> {
    const doc = this.newDoc()
    this.writeHeader(doc, ctx.clinic)
    this.writeTitle(doc, 'ATESTADO MÉDICO')
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

    this.writeFooter(doc, ctx.doctor, ctx.document)
    return this.streamToBuffer(doc)
  }

  // --- helpers ---

  private newDoc() {
    return new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 70, left: 60, right: 60 },
      info: {
        Title: 'med.bula — Documento médico',
        Author: 'med.bula',
      },
    })
  }

  private writeHeader(doc: PDFKit.PDFDocument, clinic: Clinic) {
    const startY = doc.y
    doc
      .fontSize(13)
      .fillColor(COLOR_PRIMARY)
      .font('Helvetica-Bold')
      .text(clinic.name, { align: 'center' })

    doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica')
    if (clinic.address) doc.text(clinic.address, { align: 'center' })
    const meta: string[] = []
    if (clinic.cnpj) meta.push(`CNPJ ${clinic.cnpj}`)
    if (clinic.phone) meta.push(clinic.phone)
    if (meta.length) doc.text(meta.join('   ·   '), { align: 'center' })

    doc.moveDown(0.6)
    doc
      .strokeColor(COLOR_PRIMARY)
      .lineWidth(2)
      .moveTo(60, doc.y)
      .lineTo(535, doc.y)
      .stroke()
    doc.moveDown(1)
    void startY
  }

  private writeTitle(doc: PDFKit.PDFDocument, title: string) {
    doc
      .fontSize(15)
      .fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .text(title, { align: 'center', characterSpacing: 1 })
    doc.moveDown(1)
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

    const labelOpts = { width: 60 }
    const startY = doc.y
    doc.fontSize(10).fillColor(COLOR_MUTED).font('Helvetica-Bold')
    doc.text('Paciente:', 60, startY, labelOpts)
    doc.fillColor(COLOR_TEXT).font('Helvetica')
    doc.text(patient.fullName, 130, startY)

    let y = doc.y + 4
    if (patient.cpf) {
      doc.fillColor(COLOR_MUTED).font('Helvetica-Bold').text('CPF:', 60, y, labelOpts)
      doc.fillColor(COLOR_TEXT).font('Helvetica').text(patient.cpf, 130, y)
      y = doc.y + 4
    }
    doc.fillColor(COLOR_MUTED).font('Helvetica-Bold').text('Emitido:', 60, y, labelOpts)
    doc.fillColor(COLOR_TEXT).font('Helvetica').text(issued, 130, y)

    doc.moveDown(1.2)
    doc
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .moveTo(60, doc.y)
      .lineTo(535, doc.y)
      .stroke()
    doc.moveDown(0.8)
  }

  private writePrescriptionItem(
    doc: PDFKit.PDFDocument,
    item: PrescriptionItem,
    idx: number
  ) {
    doc
      .fontSize(12)
      .fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .text(`${idx}. ${item.name}`)

    doc.fontSize(10.5).font('Helvetica').fillColor(COLOR_TEXT)

    const lines: string[] = []
    if (item.dose) lines.push(`Dosagem: ${item.dose}`)
    if (item.route) lines.push(`Via: ${item.route}`)
    if (item.frequency) lines.push(`Posologia: ${item.frequency}`)
    if (item.duration) lines.push(`Duração: ${item.duration}`)
    if (item.notes) lines.push(item.notes)

    lines.forEach((line) => doc.text(line, { indent: 18 }))

    if (item.controlled) {
      doc
        .fillColor(COLOR_PRIMARY)
        .font('Helvetica-Bold')
        .text('  ⚠  Medicamento controlado — necessita receituário especial', {
          indent: 18,
        })
    }

    doc.fillColor(COLOR_TEXT).font('Helvetica')
    doc.moveDown(0.7)
  }

  private writeFooter(
    doc: PDFKit.PDFDocument,
    doctor: User,
    document: Document
  ) {
    // Sempre garante espaço pro rodapé na última página
    if (doc.y > 700) doc.addPage()
    doc.moveDown(3)

    // linha de assinatura
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

    // Pé da página com aviso de assinatura pendente
    const status =
      document.status === 'signed' ? 'Documento assinado digitalmente' : 'Aguardando assinatura digital (ICP-Brasil)'
    doc
      .fontSize(8)
      .fillColor(COLOR_MUTED)
      .text(`med.bula — ${status} — id: ${document.id}`, 60, 770, {
        width: 475,
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
