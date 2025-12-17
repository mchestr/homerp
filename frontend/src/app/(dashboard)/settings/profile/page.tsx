"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Brain, Loader2, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  profileApi,
  categoriesApi,
  UserSystemProfile,
  UserSystemProfileCreate,
  Category,
} from "@/lib/api/api";

// Hobby type display labels
const HOBBY_LABELS: Record<string, string> = {
  electronics: "Electronics",
  woodworking: "Woodworking",
  "3d_printing": "3D Printing",
  metalworking: "Metalworking",
  sewing: "Sewing",
  knitting: "Knitting",
  jewelry_making: "Jewelry Making",
  painting: "Painting",
  miniatures: "Miniatures",
  model_building: "Model Building",
  rc_vehicles: "RC Vehicles",
  drones: "Drones",
  photography: "Photography",
  gaming: "Gaming",
  music: "Music",
  home_improvement: "Home Improvement",
  gardening: "Gardening",
  cooking: "Cooking",
  brewing: "Brewing",
  leatherworking: "Leatherworking",
  automotive: "Automotive",
  cycling: "Cycling",
  camping: "Camping",
  fishing: "Fishing",
  collecting: "Collecting",
  other: "Other",
};

export default function SystemProfilePage() {
  const t = useTranslations("systemProfile");
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hobbyTypes, setHobbyTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [, setProfile] = useState<UserSystemProfile | null>(null);

  // Form state
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [retentionMonths, setRetentionMonths] = useState(12);
  const [quantityThreshold, setQuantityThreshold] = useState(5);
  const [minValueKeep, setMinValueKeep] = useState<string>("");
  const [profileDescription, setProfileDescription] = useState("");
  const [purgeAggressiveness, setPurgeAggressiveness] = useState<
    "conservative" | "moderate" | "aggressive"
  >("moderate");

  useEffect(() => {
    async function loadData() {
      try {
        const [hobbyTypesRes, categoriesRes, profileRes] = await Promise.all([
          profileApi.getHobbyTypes(),
          categoriesApi.list(),
          profileApi.getProfile(),
        ]);

        setHobbyTypes(hobbyTypesRes.hobby_types ?? []);
        setCategories(categoriesRes);

        if (profileRes) {
          setProfile(profileRes);
          setSelectedHobbies(profileRes.hobby_types || []);
          setSelectedCategories(profileRes.interest_category_ids || []);
          setRetentionMonths(profileRes.retention_months ?? 12);
          setQuantityThreshold(profileRes.min_quantity_threshold ?? 5);
          setMinValueKeep(profileRes.min_value_keep?.toString() || "");
          setProfileDescription(profileRes.profile_description || "");
          setPurgeAggressiveness(
            (profileRes.purge_aggressiveness as
              | "conservative"
              | "moderate"
              | "aggressive") ?? "moderate"
          );
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [toast]);

  const toggleHobby = (hobby: string) => {
    setSelectedHobbies((prev) =>
      prev.includes(hobby) ? prev.filter((h) => h !== hobby) : [...prev, hobby]
    );
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((c) => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data: UserSystemProfileCreate = {
        hobby_types: selectedHobbies,
        interest_category_ids: selectedCategories,
        retention_months: retentionMonths,
        min_quantity_threshold: quantityThreshold,
        min_value_keep: minValueKeep ? parseFloat(minValueKeep) : null,
        profile_description: profileDescription || null,
        purge_aggressiveness: purgeAggressiveness,
      };

      const result = await profileApi.createProfile(data);
      setProfile(result);

      toast({
        title: t("profileSaved"),
        description: "",
      });
    } catch {
      toast({
        title: "Error",
        description: t("profileError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
      </div>

      {/* Hobby Types */}
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <Sparkles className="text-primary h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">{t("hobbyTypes")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("hobbyTypesDescription")}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {hobbyTypes.map((hobby) => (
            <Badge
              key={hobby}
              variant={selectedHobbies.includes(hobby) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleHobby(hobby)}
              data-testid={`hobby-${hobby}`}
            >
              {HOBBY_LABELS[hobby] || hobby}
            </Badge>
          ))}
        </div>
      </div>

      {/* Interest Categories */}
      {categories.length > 0 && (
        <div className="bg-card rounded-xl border p-6">
          <h2 className="font-semibold">{t("interestCategories")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("interestCategoriesDescription")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant={
                  selectedCategories.includes(category.id)
                    ? "default"
                    : "outline"
                }
                className="cursor-pointer"
                onClick={() => toggleCategory(category.id)}
                data-testid={`category-${category.id}`}
              >
                {category.icon && <span className="mr-1">{category.icon}</span>}
                {category.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Retention Settings */}
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <Brain className="text-primary h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">{t("retentionMonths")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("retentionMonthsDescription")}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Input
            type="number"
            min={1}
            max={120}
            value={retentionMonths}
            onChange={(e) => setRetentionMonths(parseInt(e.target.value) || 12)}
            className="w-24"
            data-testid="retention-months-input"
          />
          <span className="text-muted-foreground text-sm">
            {t("retentionMonthsUnit")}
          </span>
        </div>
      </div>

      {/* Quantity Threshold */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("quantityThreshold")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("quantityThresholdDescription")}
        </p>
        <div className="mt-4">
          <Input
            type="number"
            min={1}
            max={1000}
            value={quantityThreshold}
            onChange={(e) =>
              setQuantityThreshold(parseInt(e.target.value) || 5)
            }
            className="w-24"
            data-testid="quantity-threshold-input"
          />
        </div>
      </div>

      {/* Minimum Value to Keep */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("minValueKeep")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("minValueKeepDescription")}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-muted-foreground">$</span>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={minValueKeep}
            onChange={(e) => setMinValueKeep(e.target.value)}
            placeholder="0.00"
            className="w-32"
            data-testid="min-value-keep-input"
          />
        </div>
      </div>

      {/* Profile Description */}
      <div className="bg-card rounded-xl border p-6">
        <Label htmlFor="profile-description" className="font-semibold">
          {t("profileDescription")}
        </Label>
        <p className="text-muted-foreground text-sm">
          {t("profileDescriptionDescription")}
        </p>
        <Textarea
          id="profile-description"
          className="mt-4"
          rows={4}
          value={profileDescription}
          onChange={(e) => setProfileDescription(e.target.value)}
          placeholder={t("profileDescriptionPlaceholder")}
          maxLength={1000}
          data-testid="profile-description-input"
        />
      </div>

      {/* Purge Aggressiveness */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="font-semibold">{t("purgeAggressiveness")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("purgeAggressivenessDescription")}
        </p>
        <div className="mt-4">
          <Select
            value={purgeAggressiveness}
            onValueChange={(
              value: "conservative" | "moderate" | "aggressive"
            ) => setPurgeAggressiveness(value)}
          >
            <SelectTrigger
              className="w-full md:w-64"
              data-testid="purge-aggressiveness-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">
                <div>
                  <div className="font-medium">
                    {t("aggressivenessConservative")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("aggressivenessConservativeDescription")}
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="moderate">
                <div>
                  <div className="font-medium">
                    {t("aggressivenessModerate")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("aggressivenessModerateDescription")}
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="aggressive">
                <div>
                  <div className="font-medium">
                    {t("aggressivenessAggressive")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("aggressivenessAggressiveDescription")}
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          data-testid="save-profile-button"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("saveProfile")}
        </Button>
      </div>
    </div>
  );
}
