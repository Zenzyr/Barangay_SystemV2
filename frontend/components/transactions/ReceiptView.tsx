"use client";

import { forwardRef } from "react";
import { ReceiptData } from "@/app/types/transaction.type";
import {
  PAYMENT_METHOD_LABELS,
  REQUEST_SOURCE_LABELS,
  VAT_RATE,
  formatChannel,
  formatCurrency,
  formatDateTime,
} from "@/app/utils/transactionFormat";

const Divider = () => <div className="border-t border-dashed border-[#d4c5a9] mx-4" />;

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={strong ? "font-semibold text-gray-900 text-right" : "text-right"}>{value}</span>
    </div>
  );
}

export const ReceiptView = forwardRef<HTMLDivElement, { receipt: ReceiptData }>(function ReceiptView({ receipt }, ref) {
  const vat = receipt.amount * VAT_RATE;
  const subtotal = receipt.amount - vat;
  const isOnline = receipt.paymentMethod === "online";

  return (
    <div
      ref={ref}
      className="relative bg-[#fffdf7] border border-[#e8dcc8] shadow-lg mx-auto"
      style={{ width: "340px", fontFamily: "'Courier New', 'Courier', monospace" }}
    >
      {receipt.voided && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-[24deg] border-4 border-rose-500/70 px-4 py-1 text-4xl font-black tracking-[0.3em] text-rose-500/70">VOID</span>
        </div>
      )}
      <div className="border-b border-dashed border-[#d4c5a9] mx-4" />

      <div className="px-5 pt-5 pb-2 text-center">
        {receipt.barangay.logoUrl && (
          <div className="mx-auto mb-2 size-10 border border-[#d4c5a9] overflow-hidden bg-white">
            <img src={receipt.barangay.logoUrl} alt="" crossOrigin="anonymous" className="w-full h-full object-cover" />
          </div>
        )}
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{receipt.barangay.name}</h2>
        {receipt.barangay.address && <p className="text-[10px] text-gray-500 mt-0.5">{receipt.barangay.address}</p>}
        {receipt.barangay.contactNumber && <p className="text-[10px] text-gray-500">Tel: {receipt.barangay.contactNumber}</p>}
        <div className="mt-3 pt-2 border-t border-dashed border-[#d4c5a9]">
          <p className="text-[11px] font-bold text-gray-800 uppercase tracking-[0.2em]">Official Receipt</p>
          <p
            className={`mt-1 inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border ${
              isOnline ? "border-sky-300 text-sky-700" : "border-emerald-300 text-emerald-700"
            }`}
          >
            {PAYMENT_METHOD_LABELS[receipt.paymentMethod] || receipt.paymentMethod} Payment
          </p>
        </div>
      </div>

      <div className="px-5 py-2 space-y-1 text-[11px] text-gray-700">
        <Row label="Receipt No:" value={receipt.receiptNumber} strong />
        <Row label="Date Paid:" value={receipt.paidAt ? formatDateTime(receipt.paidAt) : "Not recorded"} />
        {receipt.processedBy && <Row label="Cashier:" value={receipt.processedBy} />}
        {receipt.verificationStatus && (
          <Row
            label="Verification:"
            value={receipt.voided ? "Rejected" : receipt.verificationStatus === "verified" ? "Verified" : "Pending"}
          />
        )}
      </div>

      <Divider />

      <div className="px-5 py-2 text-[11px] text-gray-700">
        <span className="text-gray-500">Payer:</span>
        <p className="font-semibold text-gray-900">{receipt.payer.name}</p>
        {receipt.payer.address && <p className="text-gray-500 text-[10px]">{receipt.payer.address}</p>}
      </div>

      <Divider />

      <div className="px-5 py-2">
        <div className="flex justify-between text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-1.5">
          <span>Description</span>
          <span>Amount</span>
        </div>
        <div className="flex justify-between gap-3 text-[11px] text-gray-700">
          <span>{receipt.item.documentName}</span>
          <span className="shrink-0">{formatCurrency(receipt.amount)}</span>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Request #{receipt.requestId.slice(-6).toUpperCase()} · {REQUEST_SOURCE_LABELS[receipt.requestSource] || receipt.requestSource} request
        </p>
      </div>

      <Divider />

      <div className="px-5 py-2 space-y-1 text-[11px]">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal (excl. VAT)</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>VAT (12%)</span>
          <span>{formatCurrency(vat)}</span>
        </div>
        <div className="border-t border-dashed border-[#d4c5a9] pt-1 flex justify-between font-bold text-gray-900 text-sm">
          <span>TOTAL</span>
          <span>{formatCurrency(receipt.amount)}</span>
        </div>
      </div>

      <Divider />

      <div className="px-5 py-2 space-y-1 text-[11px] text-gray-600">
        <Row label="Payment Method" value={PAYMENT_METHOD_LABELS[receipt.paymentMethod] || receipt.paymentMethod} />
        <Row label="Channel" value={formatChannel(receipt.paymentChannel)} />
        {receipt.paymentReference && <Row label="Reference No." value={receipt.paymentReference} />}
        {receipt.amountTendered !== null && !isOnline && <Row label="Amount Tendered" value={formatCurrency(receipt.amountTendered)} />}
        {receipt.changeGiven !== null && !isOnline && <Row label="Change" value={formatCurrency(receipt.changeGiven)} />}
      </div>

      <Divider />

      <div className="px-5 py-4 text-center space-y-1">
        {receipt.voided && (
          <p className="text-[10px] font-bold text-rose-600 uppercase">
            Voided — payment rejected{receipt.rejectionReason ? `: ${receipt.rejectionReason}` : ""}
          </p>
        )}
        <p className="text-[11px] font-semibold text-gray-800">Maraming Salamat!</p>
        <p className="text-[9px] text-gray-400">This serves as your official receipt.</p>
        <p className="text-[9px] text-gray-400">Keep this for your records.</p>
        {receipt.item.documentNumber && <p className="text-[9px] text-gray-500 mt-2">Doc Ref: {receipt.item.documentNumber}</p>}
        <p className="tracking-widest text-[10px] text-gray-500 mt-2">*** THANK YOU ***</p>
      </div>

      <div className="border-b border-dashed border-[#d4c5a9] mx-4" />
      <div className="h-3" />
    </div>
  );
});
