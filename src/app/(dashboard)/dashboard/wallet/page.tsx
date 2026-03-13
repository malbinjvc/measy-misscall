"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Phone,
  MessageSquare,
  Settings2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface WalletData {
  ratePerUnit: number;
  wallet: {
    balance: number;
    autoRecharge: boolean;
    rechargeThreshold: number;
    rechargeAmount: number;
  };
  usage: {
    smsUsed: number;
    smsLimit: number;
    callsUsed: number;
    callsLimit: number;
    periodStart: string;
    periodEnd: string | null;
  };
  transactions: {
    id: string;
    type: string;
    amount: number;
    balance: number;
    description: string | null;
    createdAt: string;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function WalletPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(50);

  const { data, isLoading } = useQuery<WalletData>({
    queryKey: ["wallet", String(page)],
    queryFn: async () => {
      const res = await fetch(`/api/wallet?page=${page}&limit=15`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 30000,
  });

  const rechargeMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/wallet/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setShowRecharge(false);
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async (settings: { autoRecharge?: boolean; rechargeThreshold?: number; rechargeAmount?: number }) => {
      const res = await fetch("/api/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const wallet = data?.wallet;
  const usage = data?.usage;
  const transactions = data?.transactions || [];
  const pagination = data?.pagination;

  const rate = data?.ratePerUnit || 0.035;
  const smsOverage = Math.max(0, (usage?.smsUsed || 0) - (usage?.smsLimit || 0));
  const callsOverage = Math.max(0, (usage?.callsUsed || 0) - (usage?.callsLimit || 0));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Manage your usage balance and auto-recharge settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setShowRecharge(!showRecharge)}>
            <ArrowUpCircle className="h-4 w-4 mr-1" />
            Add Funds
          </Button>
        </div>
      </div>

      {/* Balance & Usage Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Balance Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Wallet className="h-4 w-4" />
            Current Balance
          </div>
          <div className={`text-3xl font-bold ${(wallet?.balance || 0) < 10 ? "text-red-500" : "text-green-600"}`}>
            ${(wallet?.balance || 0).toFixed(2)}
            <span className="text-sm font-normal text-muted-foreground ml-1">CAD</span>
          </div>
          {wallet?.autoRecharge && (
            <p className="text-xs text-muted-foreground mt-2">
              Auto-recharge ${wallet.rechargeAmount.toFixed(0)} when below ${wallet.rechargeThreshold.toFixed(0)}
            </p>
          )}
        </div>

        {/* SMS Usage Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <MessageSquare className="h-4 w-4" />
            SMS This Period
          </div>
          <div className="text-3xl font-bold">
            {usage?.smsUsed || 0}
            <span className="text-sm font-normal text-muted-foreground">
              /{usage?.smsLimit || 0} free
            </span>
          </div>
          {smsOverage > 0 && (
            <p className="text-xs text-orange-500 mt-2">
              {smsOverage} extra @ ${rate}/msg = ${(smsOverage * rate).toFixed(2)}
            </p>
          )}
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (usage?.smsUsed || 0) > (usage?.smsLimit || 0) ? "bg-orange-500" : "bg-green-500"
              }`}
              style={{
                width: `${Math.min(100, ((usage?.smsUsed || 0) / Math.max(1, usage?.smsLimit || 1)) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Calls Usage Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Phone className="h-4 w-4" />
            Calls This Period
          </div>
          <div className="text-3xl font-bold">
            {usage?.callsUsed || 0}
            <span className="text-sm font-normal text-muted-foreground">
              /{usage?.callsLimit || 0} free
            </span>
          </div>
          {callsOverage > 0 && (
            <p className="text-xs text-orange-500 mt-2">
              {callsOverage} extra calls @ ${rate}/call-min
            </p>
          )}
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (usage?.callsUsed || 0) > (usage?.callsLimit || 0) ? "bg-orange-500" : "bg-green-500"
              }`}
              style={{
                width: `${Math.min(100, ((usage?.callsUsed || 0) / Math.max(1, usage?.callsLimit || 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Recharge Panel */}
      {showRecharge && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">Add Funds to Wallet</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {[25, 50, 100, 200].map((amt) => (
              <Button
                key={amt}
                variant={rechargeAmount === amt ? "default" : "outline"}
                size="sm"
                onClick={() => setRechargeAmount(amt)}
              >
                ${amt}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Amount:</span>
              <input
                type="number"
                min={10}
                max={500}
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(Number(e.target.value))}
                className="w-24 rounded-md border px-3 py-1.5 text-sm"
              />
              <span className="text-sm text-muted-foreground">CAD</span>
            </div>
            <Button
              onClick={() => rechargeMutation.mutate(rechargeAmount)}
              disabled={rechargeMutation.isPending}
            >
              {rechargeMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                `Charge $${rechargeAmount}`
              )}
            </Button>
          </div>
          {rechargeMutation.isError && (
            <p className="text-sm text-red-500 mt-2">
              {(rechargeMutation.error as Error).message}
            </p>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">Auto-Recharge Settings</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={wallet?.autoRecharge ?? true}
                onChange={(e) =>
                  settingsMutation.mutate({ autoRecharge: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">Enable auto-recharge</span>
            </label>
            {wallet?.autoRecharge && (
              <div className="grid gap-4 sm:grid-cols-2 pl-7">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">
                    Recharge when balance drops below
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">$</span>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      defaultValue={wallet?.rechargeThreshold || 10}
                      onBlur={(e) =>
                        settingsMutation.mutate({ rechargeThreshold: Number(e.target.value) })
                      }
                      className="w-24 rounded-md border px-3 py-1.5 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">CAD</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">
                    Recharge amount
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">$</span>
                    <input
                      type="number"
                      min={10}
                      max={500}
                      defaultValue={wallet?.rechargeAmount || 50}
                      onBlur={(e) =>
                        settingsMutation.mutate({ rechargeAmount: Number(e.target.value) })
                      }
                      className="w-24 rounded-md border px-3 py-1.5 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">CAD</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Usage pricing:</strong> Each SMS and each call costs <strong>${rate} CAD</strong> after
              your free tier is exhausted. Free tier resets each billing period.
            </p>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            No transactions yet
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString("en-CA", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        {tx.amount > 0 ? (
                          <ArrowUpCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        {formatType(tx.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {tx.description || "-"}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                      {tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">
                      ${tx.balance.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatType(type: string): string {
  switch (type) {
    case "RECHARGE":
      return "Auto-Recharge";
    case "MANUAL_RECHARGE":
      return "Manual Recharge";
    case "INITIAL_LOAD":
      return "Initial Load";
    case "SMS_CHARGE":
      return "SMS";
    case "CALL_CHARGE":
      return "Call";
    default:
      return type;
  }
}
