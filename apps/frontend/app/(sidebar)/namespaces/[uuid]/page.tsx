"use client";

import { ArrowLeft, Calendar, Edit, Hash, Plug, Server } from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

import { EditNamespace } from "@/components/edit-namespace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnection } from "@/hooks/useConnection";
import { trpc } from "@/lib/trpc";

import { NamespaceServersTable } from "./components/namespace-servers-table";
import { NamespaceToolManagement } from "./components/namespace-tool-management";

interface NamespaceDetailPageProps {
  params: Promise<{
    uuid: string;
  }>;
}

export default function NamespaceDetailPage({
  params,
}: NamespaceDetailPageProps) {
  const { uuid } = use(params);
  const router = useRouter();

  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);

  // Get tRPC utils for cache invalidation
  const utils = trpc.useUtils();

  // Use tRPC query for data fetching
  const {
    data: namespaceResponse,
    error,
    isLoading,
    refetch,
  } = trpc.frontend.namespaces.get.useQuery({ uuid });

  // tRPC mutation for deleting namespace
  const deleteMutation = trpc.frontend.namespaces.delete.useMutation({
    onSuccess: () => {
      // Invalidate the list cache since namespace was deleted
      utils.frontend.namespaces.list.invalidate();
      toast.success("Namespace deleted successfully");
      // Navigate back to the namespaces list
      router.push("/namespaces");
    },
    onError: (error) => {
      console.error("Error deleting namespace:", error);
      toast.error("Failed to delete namespace", {
        description: error.message,
      });
      setShowDeleteDialog(false);
    },
  });

  const namespace = namespaceResponse?.success
    ? namespaceResponse.data
    : undefined;

  // MetaMCP Connection setup - connect to the metamcp proxy endpoint for this namespace
  const connection = useConnection({
    mcpServerUuid: uuid, // Using namespace UUID as the "server" UUID for connection
    command: "", // Not needed for metamcp proxy
    args: "",
    sseUrl: `/mcp-proxy/metamcp/${uuid}/sse`, // Connect to metamcp proxy endpoint
    env: {},
    bearerToken: undefined,
    isMetaMCP: true, // Indicate this is a MetaMCP connection
    includeInactiveServers: true, // Include all servers regardless of status in namespace management
    onNotification: (notification) => {
      console.log("MetaMCP Notification:", notification);
    },
    onStdErrNotification: (notification) => {
      console.error("MetaMCP StdErr:", notification);
    },
  });

  // Auto-connect when namespace data is available and not already connected
  useEffect(() => {
    if (
      connection &&
      namespace &&
      connection.connectionStatus === "disconnected"
    ) {
      connection.connect();
    }
  }, [namespace, connection]);

  // Handle delete namespace
  const handleDeleteNamespace = async () => {
    deleteMutation.mutate({ uuid });
  };

  // Handle successful edit
  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    // The EditNamespace component already handles cache invalidation
    // So we just need to close the dialog
  };

  // Handle manual connect/disconnect
  const handleConnectionToggle = () => {
    if (connection.connectionStatus === "connected") {
      connection.disconnect();
    } else {
      connection.connect();
    }
  };

  // Get connection status display info
  const getConnectionStatusInfo = () => {
    switch (connection.connectionStatus) {
      case "connected":
        return { text: "Connected", color: "text-green-600", icon: Plug };
      case "disconnected":
        return { text: "Disconnected", color: "text-gray-500", icon: Server };
      case "error":
      case "error-connecting-to-proxy":
        return {
          text: "Connection Error",
          color: "text-red-600",
          icon: Server,
        };
      default:
        return { text: "Connecting...", color: "text-yellow-600", icon: Plug };
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (error) {
    const isNotFound =
      error.message.includes("not found") || error.message.includes("404");
    if (isNotFound) {
      notFound();
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/namespaces">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Namespaces
            </Button>
          </Link>
        </div>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <div className="flex flex-col items-center justify-center mx-auto max-w-md">
            <Hash className="size-12 text-red-400" />
            <h3 className="mt-4 text-lg font-semibold">
              Error Loading Namespace
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.message || "Failed to load namespace details"}
            </p>
            <Button
              onClick={() => refetch()}
              className="mt-4"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/namespaces">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Namespaces
            </Button>
          </Link>
        </div>

        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        {/* Namespace Details Skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-6">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MCP Servers Table Skeleton */}
        <div className="rounded-lg border p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            <div className="flex space-x-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 flex-1" />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!namespace) {
    notFound();
  }

  const connectionInfo = getConnectionStatusInfo();
  const ConnectionIcon = connectionInfo.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/namespaces">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Namespaces
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Namespace
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Namespace
          </Button>
        </div>
      </div>

      {/* Edit Namespace Dialog */}
      <EditNamespace
        namespace={namespace}
        isOpen={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Namespace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{namespace?.name}?&quot;
              This will remove all MCP server associations. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteNamespace}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Namespace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Namespace Info */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {namespace.name}
            </h1>
            {namespace.description && (
              <p className="text-muted-foreground mt-1">
                {namespace.description}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {/* MetaMCP Connection Status */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">MetaMCP Connection:</span>
              <ConnectionIcon className="h-4 w-4" />
              <span className={`text-sm font-medium ${connectionInfo.color}`}>
                {connectionInfo.text}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectionToggle}
                disabled={connection.connectionStatus === "connecting"}
              >
                {connection.connectionStatus === "connected"
                  ? "Reconnect"
                  : "Connect"}
              </Button>
            </div>
          </div>
        </div>

        {/* Section 1: Basic Overview */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <div className="rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  UUID:
                </span>
                <p className="text-sm font-mono text-right flex-1 ml-6">
                  {namespace.uuid}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Name:
                </span>
                <p className="text-sm font-medium text-right flex-1 ml-6">
                  {namespace.name}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Description:
                </span>
                <p className="text-sm text-right flex-1 ml-6">
                  {namespace.description || "No description"}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Created:
                </span>
                <div className="flex items-center gap-2 flex-1 ml-6 justify-end">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <p className="text-sm">{formatDate(namespace.created_at)}</p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Last Updated:
                </span>
                <div className="flex items-center gap-2 flex-1 ml-6 justify-end">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <p className="text-sm">{formatDate(namespace.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Statistics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  MCP Servers:
                </span>
                <div className="flex-1 ml-6 flex justify-end">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {namespace.servers.length}{" "}
                    {namespace.servers.length === 1 ? "server" : "servers"}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Active Servers:
                </span>
                <div className="flex-1 ml-6 flex justify-end">
                  <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10">
                    {
                      namespace.servers.filter((s) => s.status === "ACTIVE")
                        .length
                    }{" "}
                    active
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Server Types:
                </span>
                <div className="flex-1 ml-6 flex justify-end">
                  <div className="flex flex-wrap gap-1 justify-end">
                    {Array.from(
                      new Set(namespace.servers.map((s) => s.type)),
                    ).map((type) => (
                      <span
                        key={type}
                        className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-700/10"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: MCP Servers Data Table */}
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">MCP Servers</h3>
          <NamespaceServersTable
            servers={namespace.servers}
            namespaceUuid={namespace.uuid}
          />
        </div>

        {/* Section 3: Tools Management */}
        <div className="rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Tools Management</h3>
          {connection.connectionStatus === "connected" ? (
            <NamespaceToolManagement
              servers={namespace.servers}
              namespaceUuid={namespace.uuid}
              makeRequest={connection.makeRequest}
            />
          ) : (
            <div className="space-y-4">
              <NamespaceToolManagement
                servers={namespace.servers}
                namespaceUuid={namespace.uuid}
              />
              <div className="flex justify-center">
                <div className="text-sm text-muted-foreground">
                  {connection.connectionStatus === "connecting"
                    ? "Connecting to MetaMCP..."
                    : "Connect to MetaMCP to enable enhanced tool management"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
