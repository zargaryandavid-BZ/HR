"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import type { ManagerNoteItem } from "@/lib/individual-settings/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type EmployeeNotesSectionProps = {
  employeeId: string;
  mode: "admin" | "employee";
  onToast?: (message: string) => void;
};

/** Manager notes section for individual settings */
export function EmployeeNotesSection({
  employeeId,
  mode,
  onToast,
}: EmployeeNotesSectionProps) {
  const queryClient = useQueryClient();
  const { role, user } = useCurrentUser();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const canAdd =
    mode === "admin" &&
    ["HR_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(role ?? "");

  const { data: notes, isLoading } = useQuery({
    queryKey: ["employee-notes", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/notes`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load notes");
      return json.data as ManagerNoteItem[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/employees/${employeeId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save note");
    },
    onSuccess: async () => {
      setNewContent("");
      setShowAddForm(false);
      await queryClient.invalidateQueries({ queryKey: ["employee-notes", employeeId] });
      onToast?.("Note saved");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const res = await fetch(`/api/employees/${employeeId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update note");
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditContent("");
      await queryClient.invalidateQueries({ queryKey: ["employee-notes", employeeId] });
      onToast?.("Note updated");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await fetch(`/api/employees/${employeeId}/notes/${noteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete note");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee-notes", employeeId] });
      onToast?.("Note deleted");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  if (mode === "employee") {
    return null;
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Manager Notes</h2>
        {canAdd && !showAddForm && (
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        )}
      </div>

      {canAdd && showAddForm && (
        <div className="mb-4 space-y-3 rounded-lg border p-4">
          <Textarea
            rows={3}
            placeholder="Add a note about this employee..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!newContent.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newContent.trim())}
            >
              Save Note
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setNewContent("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !notes?.length ? (
        <p className="text-sm text-muted-foreground">No notes on record.</p>
      ) : (
        <div className="space-y-4 border-l-2 border-muted pl-4">
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              mode={mode}
              currentUserId={user?.id ?? null}
              isSuperAdmin={role === "SUPER_ADMIN"}
              editing={editingId === note.id}
              editContent={editContent}
              onStartEdit={() => {
                setEditingId(note.id);
                setEditContent(note.content);
              }}
              onEditContentChange={setEditContent}
              onSaveEdit={() =>
                updateMutation.mutate({ noteId: note.id, content: editContent.trim() })
              }
              onCancelEdit={() => {
                setEditingId(null);
                setEditContent("");
              }}
              onDelete={() => {
                if (confirm("Delete this note?")) {
                  deleteMutation.mutate(note.id);
                }
              }}
              saving={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NoteItem({
  note,
  mode,
  currentUserId,
  isSuperAdmin,
  editing,
  editContent,
  onStartEdit,
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  saving,
}: {
  note: ManagerNoteItem;
  mode: "admin" | "employee";
  currentUserId: string | null;
  isSuperAdmin: boolean;
  editing: boolean;
  editContent: string;
  onStartEdit: () => void;
  onEditContentChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const isAuthor = currentUserId === note.issuedBy;
  const canEdit = mode === "admin" && isAuthor;
  const canDelete = mode === "admin" && (isAuthor || isSuperAdmin);

  return (
    <div className="relative pb-2">
      {editing ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!editContent.trim() || saving} onClick={onSaveEdit}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {note.issuedByName} on {format(new Date(note.createdAt), "MMM d, yyyy")}
          </p>
          {(canEdit || canDelete) && (
            <div className="flex gap-1 mt-2">
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStartEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
