"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

// ─── Types ────────────────────────────────────────────

interface CaParType {
  type: string;
  ca: number;
  count: number;
  benefice: number;
}

interface CaParMois {
  mois: string;
  ca: number;
  count: number;
  benefice: number;
}

interface CaParRegion {
  region: string;
  ca: number;
  count: number;
}

interface ReportChartsProps {
  caParType: CaParType[];
  caParMois: CaParMois[];
  caParRegion: CaParRegion[];
}

// Couleurs pour les graphiques
const COLORS = [
  "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#06b6d4", "#84cc16",
];

const TYPE_LABELS: Record<string, string> = {
  FOIRE_MEDIEVALE: "Médiévale",
  MARCHE: "Marché",
  FOIRE_ARTISANALE: "Artisanale",
  SALON: "Salon",
  BROCANTE: "Brocante",
  AUTRE: "Autre",
};

const MOIS_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Juin", "07": "Juil", "08": "Aoû",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

// ─── Composant ───────────────────────────────────────

export default function ReportCharts({
  caParType,
  caParMois,
  caParRegion,
}: ReportChartsProps) {
  // Formatter les données pour l'affichage
  const typeData = caParType.map((d) => ({
    ...d,
    label: TYPE_LABELS[d.type] || d.type,
  }));

  const moisData = caParMois.map((d) => {
    const [, m] = d.mois.split("-");
    return {
      ...d,
      label: MOIS_LABELS[m] || m,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* CA par type d'événement */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-4 text-sm font-medium text-zinc-300">
          CA par type d&apos;événement
        </h3>
        {typeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                formatter={(value) => [`${Number(value).toFixed(0)}€`, ""]}
              />
              <Bar dataKey="ca" name="CA" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="benefice" name="Bénéfice" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-zinc-500 text-center py-8">Aucune donnée</p>
        )}
      </div>

      {/* Évolution CA par mois */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-4 text-sm font-medium text-zinc-300">
          Évolution mensuelle
        </h3>
        {moisData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={moisData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                formatter={(value) => [`${Number(value).toFixed(0)}€`, ""]}
              />
              <Line
                type="monotone"
                dataKey="ca"
                name="CA"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="benefice"
                name="Bénéfice"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-zinc-500 text-center py-8">Aucune donnée</p>
        )}
      </div>

      {/* Répartition par région (Pie) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-4 text-sm font-medium text-zinc-300">
          CA par région
        </h3>
        {caParRegion.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={caParRegion}
                dataKey="ca"
                nameKey="region"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, value }: { name?: string; value?: number }) =>
                  `${name || ""}: ${(value || 0).toFixed(0)}€`
                }
                labelLine={false}
              >
                {caParRegion.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                formatter={(value) => [`${Number(value).toFixed(0)}€`, "CA"]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-zinc-500 text-center py-8">Aucune donnée</p>
        )}
      </div>

      {/* Tableau rentabilité */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-4 text-sm font-medium text-zinc-300">
          Rentabilité par type
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-2 text-left font-medium">Type</th>
                <th className="py-2 text-right font-medium">Nb</th>
                <th className="py-2 text-right font-medium">CA</th>
                <th className="py-2 text-right font-medium">Bénéfice</th>
                <th className="py-2 text-right font-medium">Marge</th>
              </tr>
            </thead>
            <tbody>
              {typeData.map((d) => {
                const marge = d.ca > 0 ? (d.benefice / d.ca) * 100 : 0;
                return (
                  <tr key={d.type} className="border-b border-zinc-800/50">
                    <td className="py-2 text-zinc-300">{d.label}</td>
                    <td className="py-2 text-right">{d.count}</td>
                    <td className="py-2 text-right font-mono">{d.ca.toFixed(0)}€</td>
                    <td
                      className={`py-2 text-right font-mono ${
                        d.benefice >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {d.benefice.toFixed(0)}€
                    </td>
                    <td
                      className={`py-2 text-right font-mono ${
                        marge >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {marge.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
