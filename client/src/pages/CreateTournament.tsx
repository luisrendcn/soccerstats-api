import {
  useCreateTournament,
  useTournament,
  useTournamentBackgroundSignature,
  useUpdateTournament,
} from "@/hooks/use-tournaments";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Image as ImageIcon, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TournamentFormProps {
  tournamentId?: number;
}

export default function CreateTournament({ tournamentId }: TournamentFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();
  const backgroundSignature = useTournamentBackgroundSignature();
  const { data: existingTournament } = useTournament(tournamentId || 0);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    backgroundImageUrl: "",
    tournamentType: "soccer" as "soccer" | "videogame",
    startDate: "",
    endDate: "",
    status: "draft" as "draft" | "active" | "finished",
  });
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState("");
  const [backgroundInputKey, setBackgroundInputKey] = useState(0);

  useEffect(() => {
    if (existingTournament) {
      setFormData({
        name: existingTournament.name || "",
        description: existingTournament.description || "",
        backgroundImageUrl: existingTournament.backgroundImageUrl || "",
        tournamentType:
          (existingTournament.tournamentType as "soccer" | "videogame") ||
          "soccer",
        startDate: existingTournament.startDate
          ? new Date(existingTournament.startDate).toISOString().split("T")[0]
          : "",
        endDate: existingTournament.endDate
          ? new Date(existingTournament.endDate).toISOString().split("T")[0]
          : "",
        status: (existingTournament.status as any) || "draft",
      });
    }
  }, [existingTournament]);

  useEffect(() => {
    if (!backgroundFile) {
      setBackgroundPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(backgroundFile);
    setBackgroundPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [backgroundFile]);

  const uploadTournamentBackground = async (file: File) => {
    const signature = await backgroundSignature.mutateAsync();
    if (file.size > signature.maxFileSizeBytes) {
      throw new Error(t("tournamentBackgroundTooLarge"));
    }
    if (!file.type.startsWith("image/")) {
      throw new Error(t("tournamentBackgroundMustBeImage"));
    }

    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("api_key", signature.apiKey);
    uploadForm.append("timestamp", String(signature.timestamp));
    uploadForm.append("folder", signature.folder);
    uploadForm.append("signature", signature.signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
      { method: "POST", body: uploadForm },
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error?.message || t("tournamentBackgroundUploadError"));
    }
    return payload.secure_url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("tournamentNameRequired"),
      });
      return;
    }

    if (!formData.startDate) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("startDateRequired"),
      });
      return;
    }

    try {
      const backgroundImageUrl = backgroundFile
        ? await uploadTournamentBackground(backgroundFile)
        : formData.backgroundImageUrl || null;
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        backgroundImageUrl,
        tournamentType: formData.tournamentType,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        status: formData.status,
      };

      if (tournamentId) {
        await updateTournament.mutateAsync({ id: tournamentId, data });
        toast({ title: `✓ ${t("tournamentUpdated")}` });
      } else {
        await createTournament.mutateAsync(data as any);
        toast({ title: `✓ ${t("tournamentCreated")}` });
      }

      setLocation("/tournaments");
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: error instanceof Error ? error.message : t("unexpectedError"),
      });
    }
  };

  const isLoading =
    createTournament.isPending ||
    updateTournament.isPending ||
    backgroundSignature.isPending;
  const activeBackgroundPreview =
    backgroundPreviewUrl || formData.backgroundImageUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/tournaments")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("goBack")}
        </Button>
        <h1 className="text-3xl font-bold">
          {tournamentId ? t("editTournament") : t("createNewTournament")}
        </h1>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t("tournamentName")} *</Label>
            <Input
              id="name"
              placeholder={t("tournamentNamePlaceholder")}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              placeholder={t("tournamentDescriptionPlaceholder")}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="backgroundImage">{t("tournamentBackgroundImage")}</Label>
            {activeBackgroundPreview && (
              <div className="relative overflow-hidden rounded-lg border border-border">
                <img
                  src={activeBackgroundPreview}
                  alt=""
                  className="h-36 w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={() => {
                    setBackgroundFile(null);
                    setFormData({ ...formData, backgroundImageUrl: "" });
                    setBackgroundInputKey((key) => key + 1);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  {t("remove")}
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Input
                key={backgroundInputKey}
                id="backgroundImage"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setBackgroundFile(event.target.files?.[0] || null)
                }
              />
              <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("tournamentBackgroundImageHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tournamentType">{t("tournamentType")}</Label>
            <Select
              value={formData.tournamentType}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  tournamentType: value as "soccer" | "videogame",
                })
              }
            >
              <SelectTrigger id="tournamentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soccer">{t("soccer")}</SelectItem>
                <SelectItem value="videogame">{t("videogameEfootball")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("videogameTournamentHint")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("startDate")} *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">{t("endDate")}</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t("status")}</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  status: value as "draft" | "active" | "finished",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="active">{t("active")}</SelectItem>
                <SelectItem value="finished">{t("finished")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {backgroundSignature.isPending
                    ? t("uploadingBackground")
                    : tournamentId
                      ? t("updating")
                      : t("creating")}
                </>
              ) : tournamentId ? (
                t("updateTournament")
              ) : (
                t("createTournament")
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/tournaments")}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
