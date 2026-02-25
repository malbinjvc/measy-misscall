"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingTable } from "@/components/shared/loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function AdminPlansPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", description: "", price: 0, interval: "month",
    maxCalls: 100, maxSms: 100, maxServices: 10, maxStaff: 3,
    features: [] as string[], isActive: true, stripePriceId: "",
  });
  const [featureInput, setFeatureInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const res = await fetch("/api/admin/plans");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-plans"] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-plans"] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/admin/plans", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] }),
  });

  function openCreate() {
    setEditingPlan(null);
    setForm({ name: "", description: "", price: 0, interval: "month", maxCalls: 100, maxSms: 100, maxServices: 10, maxStaff: 3, features: [], isActive: true, stripePriceId: "" });
    setIsDialogOpen(true);
  }

  function openEdit(plan: any) {
    setEditingPlan(plan);
    setForm({
      name: plan.name, description: plan.description || "", price: plan.price, interval: plan.interval,
      maxCalls: plan.maxCalls, maxSms: plan.maxSms, maxServices: plan.maxServices, maxStaff: plan.maxStaff,
      features: plan.features || [], isActive: plan.isActive, stripePriceId: plan.stripePriceId || "",
    });
    setIsDialogOpen(true);
  }

  function closeDialog() { setIsDialogOpen(false); setEditingPlan(null); }

  function addFeature() {
    if (featureInput.trim()) {
      setForm({ ...form, features: [...form.features, featureInput.trim()] });
      setFeatureInput("");
    }
  }

  function removeFeature(index: number) {
    setForm({ ...form, features: form.features.filter((_, i) => i !== index) });
  }

  function handleSubmit() {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <PageHeader title="Plans" description="Manage subscription plans" action={{ label: "Add Plan", onClick: openCreate, icon: <Plus className="h-4 w-4 mr-2" /> }} />

      {isLoading ? <LoadingTable /> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.map((plan: any) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{formatCurrency(plan.price)}/{plan.interval}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{plan.maxCalls} calls, {plan.maxSms} SMS, {plan.maxServices} services</TableCell>
                  <TableCell>{plan._count?.subscriptions || 0}</TableCell>
                  <TableCell><Badge variant={plan.isActive ? "success" : "secondary"}>{plan.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(plan.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onClose={closeDialog}>
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Add Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Price ($)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Stripe Price ID</Label><Input value={form.stripePriceId} onChange={(e) => setForm({ ...form, stripePriceId: e.target.value })} placeholder="price_xxxxxxx" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Max Calls</Label><Input type="number" value={form.maxCalls} onChange={(e) => setForm({ ...form, maxCalls: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Max SMS</Label><Input type="number" value={form.maxSms} onChange={(e) => setForm({ ...form, maxSms: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Max Services</Label><Input type="number" value={form.maxServices} onChange={(e) => setForm({ ...form, maxServices: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Max Staff</Label><Input type="number" value={form.maxStaff} onChange={(e) => setForm({ ...form, maxStaff: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Features</Label>
              <div className="flex gap-2">
                <Input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} placeholder="Add a feature" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())} />
                <Button variant="outline" onClick={addFeature} type="button">Add</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {form.features.map((f, i) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeFeature(i)}>{f} x</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} /><Label>Active</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending || !form.name}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPlan ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
