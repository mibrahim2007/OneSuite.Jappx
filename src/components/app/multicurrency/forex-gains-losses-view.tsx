"use client";

export interface FxTransaction {
  id: string;
  ref: string;
  date: string;
  type: "Bill" | "Invoice" | "Payment";
  currency: string;
  rate: string;
  amount: string;
}

interface Props {
  transactions: FxTransaction[];
}

export function ForexGainsLossesView({ transactions }: Props) {
  const totalFx = transactions.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalBase = transactions.reduce((s, t) => s + parseFloat(t.amount) * parseFloat(t.rate), 0);
  const uniqueCurrencies = Array.from(new Set(transactions.map((t) => t.currency)));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Forex Gains / Losses</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">FX Transactions</p>
          <p className="text-xl font-semibold mt-1">{transactions.length}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Foreign Currencies</p>
          <p className="text-xl font-semibold mt-1">{uniqueCurrencies.join(", ") || "—"}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Base-Currency Value</p>
          <p className="text-xl font-semibold mt-1">{totalBase.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              {["Type", "Ref", "Date", "Currency", "FX Amount", "Rate", "Base Amount"].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const baseAmount = parseFloat(t.amount) * parseFloat(t.rate);
              return (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      t.type === "Invoice" ? "bg-green-100 text-green-700" :
                      t.type === "Bill" ? "bg-orange-100 text-orange-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{t.type}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{t.ref}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.date}</td>
                  <td className="px-4 py-2 font-semibold">{t.currency}</td>
                  <td className="px-4 py-2 text-right">{parseFloat(t.amount).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{parseFloat(t.rate).toFixed(6)}</td>
                  <td className="px-4 py-2 text-right font-medium">{baseAmount.toFixed(2)}</td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No foreign-currency transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
