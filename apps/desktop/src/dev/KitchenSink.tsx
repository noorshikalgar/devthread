import {
  Warning as AlertTriangle,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle as CheckCircle2,
  CaretRight as ChevronRight,
  Flag,
  Folder,
  Info,
  Plus,
  MagnifyingGlass as Search,
  Gear as Settings,
} from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ListItem } from "@/components/ds/ListItem";
import { NavItem } from "@/components/ds/NavItem";
import { SidebarLabel, SidebarRoot, SidebarSection } from "@/components/ds/Sidebar";
import { SortableList } from "@/components/ds/SortableList";
import { StatusDot } from "@/components/ds/StatusDot";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</div>
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("h-12 w-full rounded-md border border-border/50", className)} />
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

export default function KitchenSink() {
  const [sortableItems, setSortableItems] = useState([
    { id: "1", label: "Design review" },
    { id: "2", label: "Ship v2.4" },
    { id: "3", label: "Customer call" },
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">devthread design system</h1>
        <p className="text-sm text-muted-foreground">
          Tokens and components, dark-first. Toggle the app theme switcher to verify every theme.
        </p>
      </header>

      <Section title="Color tokens">
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-6">
          <Swatch name="background" className="bg-background" />
          <Swatch name="card" className="bg-card" />
          <Swatch name="muted" className="bg-muted" />
          <Swatch name="accent" className="bg-accent" />
          <Swatch name="primary" className="bg-primary" />
          <Swatch name="secondary" className="bg-secondary" />
          <Swatch name="success" className="bg-success" />
          <Swatch name="warning" className="bg-warning" />
          <Swatch name="info" className="bg-info" />
          <Swatch name="destructive" className="bg-destructive" />
          <Swatch name="border" className="bg-border" />
          <Swatch name="ring" className="bg-ring" />
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-2">
          <p className="text-2xl font-semibold tracking-tight">The quick fox ships releases</p>
          <p className="text-lg font-medium">Geist Sans — UI &amp; display</p>
          <p className="text-sm text-muted-foreground">
            Body copy at text-sm, muted-foreground for secondary text.
          </p>
          <p className="font-mono text-sm">Geist Mono — release-v2.4.0 a1b2c3d 14:32:09</p>
        </div>
      </Section>

      <Section title="Elevation & radius">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          <div className="flex h-16 items-center justify-center rounded-lg bg-card text-xs text-muted-foreground shadow-xs">shadow-xs</div>
          <div className="flex h-16 items-center justify-center rounded-lg bg-card text-xs text-muted-foreground shadow-sm">shadow-sm</div>
          <div className="flex h-16 items-center justify-center rounded-lg bg-card text-xs text-muted-foreground shadow-md">shadow-md</div>
          <div className="flex h-16 items-center justify-center rounded-lg bg-card text-xs text-muted-foreground shadow-lg">shadow-lg</div>
          <div className="flex h-16 items-center justify-center rounded-lg bg-card text-xs text-muted-foreground shadow-xl">shadow-xl</div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="success">Success</Button>
          <Button variant="warning">Warning</Button>
          <Button size="icon"><Plus /></Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges & status">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusDot tone="success" pulse /> Live
          </span>
          <Kbd>⌘K</Kbd>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-md gap-4">
          <Input placeholder="Search releases..." />
          <div className="flex items-center gap-2">
            <Checkbox id="ks-cb" defaultChecked />
            <label htmlFor="ks-cb" className="text-sm">Notify on release</label>
          </div>
          <RadioGroup defaultValue="staging" className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="staging" id="ks-r1" />
              <label htmlFor="ks-r1" className="text-sm">Staging</label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="prod" id="ks-r2" />
              <label htmlFor="ks-r2" className="text-sm">Production</label>
            </div>
          </RadioGroup>
          <div className="flex items-center gap-2">
            <Switch id="ks-sw" defaultChecked />
            <label htmlFor="ks-sw" className="text-sm">Auto-deploy</label>
          </div>
          <Progress value={64} />
        </div>
      </Section>

      <Section title="Tabs & accordion">
        <Tabs defaultValue="overview" className="max-w-md">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">
            Release summary and key metrics.
          </TabsContent>
          <TabsContent value="tasks" className="text-sm text-muted-foreground">
            12 of 18 tasks complete.
          </TabsContent>
          <TabsContent value="activity" className="text-sm text-muted-foreground">
            Latest worklog entries.
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <Accordion type="single" collapsible className="max-w-md">
          <AccordionItem value="a1">
            <AccordionTrigger>What triggers a release?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              A release is cut when all tasks in the milestone reach Done.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="a2">
            <AccordionTrigger>How are rollbacks handled?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Rollbacks revert to the last tagged build automatically.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title="Alerts & toasts">
        <div className="space-y-3">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>This release includes a schema migration.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Build failed</AlertTitle>
            <AlertDescription>Check the CI logs for stage "test".</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => toast.success("Release v2.4.0 shipped")}>Trigger success toast</Button>
            <Button size="sm" variant="outline" onClick={() => toast.error("Deploy failed")}>Trigger error toast</Button>
          </div>
        </div>
      </Section>

      <Section title="Avatars, cards & dropdowns">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar>
            <AvatarFallback>NS</AvatarFallback>
          </Avatar>
          <Card className="w-64">
            <CardHeader>
              <CardTitle className="text-sm">v2.4.0</CardTitle>
              <CardDescription>Shipped 2 days ago</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">18 tasks · 4 contributors</CardContent>
          </Card>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4" /> Actions <ChevronRight className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Edit release</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost"><Bell className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section title="Skeletons">
        <div className="space-y-2 max-w-md">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Section>

      <Section title="List items">
        <div className="max-w-md">
          <ListItem
            leading={<CheckCircle2 className="h-4 w-4" />}
            title="Fix release task status retention"
            subtitle="#142 · merged 2h ago"
            selected
            trailing={<StatusDot tone="success" />}
          />
          <ListItem
            leading={<Flag className="h-4 w-4" />}
            title="UI improvements pass"
            subtitle="#141 · in review"
            trailing={<Badge variant="outline">P1</Badge>}
          />
          <ListItem
            leading={<Folder className="h-4 w-4" />}
            title="Timeline entry types"
            subtitle="#138 · open"
          />
        </div>
      </Section>

      <Section title="Drag to reorder">
        <SortableList
          items={sortableItems}
          onReorder={setSortableItems}
          className="max-w-md gap-1"
          renderItem={(item, handle) => (
            <ListItem key={item.id} leading={handle} title={item.label} interactive={false} />
          )}
        />
      </Section>

      <Section title="Sidebar / nav">
        <div className="flex h-64 max-w-xs overflow-hidden rounded-lg border border-border">
          <SidebarRoot>
            <SidebarSection>
              <SidebarLabel>Workspace</SidebarLabel>
              <NavItem icon={<Search className="h-4 w-4" />}>Search</NavItem>
              <NavItem icon={<CalendarIcon className="h-4 w-4" />} active>
                Releases
              </NavItem>
              <NavItem icon={<Folder className="h-4 w-4" />} badge={<Badge variant="secondary">3</Badge>}>
                Backlog
              </NavItem>
            </SidebarSection>
          </SidebarRoot>
        </div>
      </Section>
    </div>
  );
}
