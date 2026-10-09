"use client";

import { useState } from "react";
import { ShoppingCart, Search } from "lucide-react";
import { Button, Modal, Switch, useToast } from "@/components/ui";

export function ModalToastDemo() {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Button variant="outline" onClick={() => setDrawer(true)} leftIcon={<ShoppingCart className="size-4" />}>
        Open drawer
      </Button>
      <Button variant="secondary" onClick={() => toast.success("Added to cart", "Brake pad set - front axle")}>
        Success toast
      </Button>
      <Button variant="ghost" onClick={() => toast.error("Payment declined", "Try another card.")} leftIcon={<Search className="size-4" />}>
        Error toast
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm fitment"
        description="Check the part against your vehicle before ordering."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Confirm</Button>
          </>
        }
      >
        <p className="max-w-prose text-muted">2019 BMW 3 Series (G20) 2.0 L turbo petrol. This part fits all trims with 312 mm front discs.</p>
      </Modal>
      <Modal open={drawer} onClose={() => setDrawer(false)} title="Your cart" placement="right">
        <p className="text-muted">Drawer content scrolls independently of the page.</p>
      </Modal>
    </div>
  );
}

export function SwitchDemo() {
  const [on, setOn] = useState(true);
  return <Switch checked={on} onCheckedChange={setOn} label="Email me order updates" />;
}
