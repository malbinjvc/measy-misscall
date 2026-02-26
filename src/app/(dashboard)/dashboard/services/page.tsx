"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wrench, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ServiceSubOptionForm {
  name: string;
  description: string;
  price: string;
}

interface ServiceOptionForm {
  name: string;
  description: string;
  price: string;
  defaultQuantity: string;
  minQuantity: string;
  maxQuantity: string;
  subOptions: ServiceSubOptionForm[];
}

const emptySubOption: ServiceSubOptionForm = { name: "", description: "", price: "" };
const emptyOption: ServiceOptionForm = { name: "", description: "", price: "", defaultQuantity: "1", minQuantity: "1", maxQuantity: "10", subOptions: [] };

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", duration: 60, price: 0, isActive: true });
  const [options, setOptions] = useState<ServiceOptionForm[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["services"] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["services"] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  function openCreate() {
    setEditingService(null);
    setForm({ name: "", description: "", duration: 60, price: 0, isActive: true });
    setOptions([]);
    setIsDialogOpen(true);
  }

  function openEdit(service: any) {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description || "",
      duration: service.duration,
      price: service.price || 0,
      isActive: service.isActive,
    });
    setOptions(
      (service.options || []).map((opt: any) => ({
        name: opt.name,
        description: opt.description || "",
        price: opt.price?.toString() || "",
        defaultQuantity: opt.defaultQuantity?.toString() || "1",
        minQuantity: opt.minQuantity?.toString() || "1",
        maxQuantity: opt.maxQuantity?.toString() || "10",
        subOptions: (opt.subOptions || []).map((sub: any) => ({
          name: sub.name,
          description: sub.description || "",
          price: sub.price?.toString() || "",
        })),
      }))
    );
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingService(null);
  }

  function addOption() {
    setOptions([...options, { ...emptyOption }]);
  }

  function updateOption(index: number, field: string, value: string) {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: value };
    setOptions(updated);
  }

  function removeOption(index: number) {
    setOptions(options.filter((_, i) => i !== index));
  }

  function addSubOption(optionIndex: number) {
    const updated = [...options];
    updated[optionIndex] = {
      ...updated[optionIndex],
      subOptions: [...updated[optionIndex].subOptions, { ...emptySubOption }],
    };
    setOptions(updated);
  }

  function updateSubOption(optionIndex: number, subIndex: number, field: keyof ServiceSubOptionForm, value: string) {
    const updated = [...options];
    const subs = [...updated[optionIndex].subOptions];
    subs[subIndex] = { ...subs[subIndex], [field]: value };
    updated[optionIndex] = { ...updated[optionIndex], subOptions: subs };
    setOptions(updated);
  }

  function removeSubOption(optionIndex: number, subIndex: number) {
    const updated = [...options];
    updated[optionIndex] = {
      ...updated[optionIndex],
      subOptions: updated[optionIndex].subOptions.filter((_, i) => i !== subIndex),
    };
    setOptions(updated);
  }

  function buildOptionsPayload() {
    return options
      .filter((opt) => opt.name.trim())
      .map((opt, idx) => ({
        name: opt.name.trim(),
        description: opt.description.trim() || undefined,
        price: opt.price ? parseFloat(opt.price) || null : null,
        isActive: true,
        sortOrder: idx,
        defaultQuantity: parseInt(opt.defaultQuantity) || 1,
        minQuantity: parseInt(opt.minQuantity) || 1,
        maxQuantity: parseInt(opt.maxQuantity) || 10,
        subOptions: opt.subOptions
          .filter((sub) => sub.name.trim())
          .map((sub) => ({
            name: sub.name.trim(),
            description: sub.description.trim() || undefined,
            price: sub.price ? parseFloat(sub.price) || null : null,
          })),
      }));
  }

  function handleSubmit() {
    const payload = {
      ...form,
      options: buildOptionsPayload(),
    };

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <PageHeader
        title="Services"
        description="Manage the services your business offers"
        action={{ label: "Add Service", onClick: openCreate, icon: <Plus className="h-4 w-4 mr-2" /> }}
      />

      {isLoading ? (
        <LoadingTable />
      ) : !data?.data?.length ? (
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title="No services yet"
          description="Add services that customers can book."
          action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Service</Button>}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Options</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((service: any) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell className="text-sm">{service.duration} min</TableCell>
                  <TableCell className="text-sm">{service.price ? formatCurrency(service.price) : "\u2014"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {service.options?.length > 0
                      ? `${service.options.length} option${service.options.length > 1 ? "s" : ""}`
                      : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={service.isActive}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: service.id, isActive: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(service)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(service.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onClose={closeDialog} className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
              <Label>Active</Label>
            </div>

            {/* Options Section */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Service Options (Variants)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                </Button>
              </div>
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No options added. Options let customers choose variants like &quot;Standard&quot; vs &quot;Premium&quot;.
                </p>
              )}
              {options.map((opt, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Option {idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOption(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Option name (e.g. Standard)"
                      value={opt.name}
                      onChange={(e) => updateOption(idx, "name", e.target.value)}
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={opt.description}
                      onChange={(e) => updateOption(idx, "description", e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Price ($)"
                      value={opt.price}
                      onChange={(e) => updateOption(idx, "price", e.target.value)}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Default Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={opt.defaultQuantity}
                          onChange={(e) => updateOption(idx, "defaultQuantity", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={opt.minQuantity}
                          onChange={(e) => updateOption(idx, "minQuantity", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={opt.maxQuantity}
                          onChange={(e) => updateOption(idx, "maxQuantity", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Sub-Options (Add-ons) */}
                    <div className="border-t pt-2 mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Sub-Options (Add-ons)</span>
                        <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => addSubOption(idx)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                      {opt.subOptions.length === 0 && (
                        <p className="text-xs text-muted-foreground">No add-ons. Add optional extras customers can select.</p>
                      )}
                      {opt.subOptions.map((sub, subIdx) => (
                        <div key={subIdx} className="border rounded p-2 space-y-1.5 bg-gray-50/50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Add-on {subIdx + 1}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeSubOption(idx, subIdx)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input
                              placeholder="Name"
                              value={sub.name}
                              onChange={(e) => updateSubOption(idx, subIdx, "name", e.target.value)}
                              className="text-xs h-8"
                            />
                            <Input
                              type="number"
                              placeholder="Price ($)"
                              value={sub.price}
                              onChange={(e) => updateSubOption(idx, subIdx, "price", e.target.value)}
                              className="text-xs h-8"
                            />
                          </div>
                          <Input
                            placeholder="Description (optional)"
                            value={sub.description}
                            onChange={(e) => updateSubOption(idx, subIdx, "description", e.target.value)}
                            className="text-xs h-8"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending || !form.name}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingService ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
