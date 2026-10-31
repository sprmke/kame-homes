import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ChevronLeft,
  Clapperboard,
  Copy,
  Download,
  History,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  PenLine,
  Send,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { AI_OUTPUT_ICON } from '@/features/dashboard/marketing/components/ai-studio/AiSessionCard';
import {
  AiStudioCreate,
  OUTPUT_FEATURE,
  POST_FORMATS,
  SizeSelect,
  type AiCreateRequest,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioCreate';
import { useAiOutputAccess } from '@/features/dashboard/marketing/components/ai-studio/AiStudioHome';
import { AiStudioRefineBox } from '@/features/dashboard/marketing/components/ai-studio/AiStudioRefineBox';
import { AiStudioStage } from '@/features/dashboard/marketing/components/ai-studio/AiStudioStage';
import {
  AiStudioThread,
  VersionThumb,
  type AiPendingTurn,
} from '@/features/dashboard/marketing/components/ai-studio/AiStudioThread';
import { MarketingInlineName } from '@/features/dashboard/marketing/components/shared/MarketingInlineName';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { useAiPosterEngine } from '@/features/dashboard/marketing/hooks/useAiPosterEngine';
import { useGenerateMarketingMedia } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import {
  useAiPremiumFlags,
  useAiSession,
  useDeleteAiSessions,
  useDeleteAiVersion,
  useRenameAiSession,
  useSavePostVersions,
} from '@/features/dashboard/marketing/hooks/useMarketingAiSessions';
import {
  GenerationRequestError,
  failedJobFromError,
  handleGenerationError,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationApi';
import {
  useMarketingGenerationReferences,
  useUploadMarketingGenerationReference,
} from '@/features/dashboard/marketing/hooks/useMarketingGenerationReferences';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { setPendingAiStartPhoto } from '@/features/dashboard/marketing/lib/aiStudioHandoff';
import {
  AI_OUTPUT_LABEL,
  buildAiTurns,
  flattenVersions,
  isVersionInFlight,
  isVersionUsable,
  latestVersion,
  postFormatLabel,
  type AiVersion,
} from '@/features/dashboard/marketing/lib/aiStudioSessions';
import {
  composerValuesFromJob,
  fileNameForGeneratedReference,
} from '@/features/dashboard/marketing/lib/marketingGenerationComposer';
import {
  IMAGE_ASPECT_RATIO_OPTIONS,
  VIDEO_CAMERA_MOVES,
  composeGenerationPrompt,
  type VideoCameraMoveId,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  DEFAULT_VIDEO_DURATION,
  estimateGenerationCredits,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import { setPendingMarketingPhoto } from '@/features/dashboard/marketing/lib/marketingPhotoHandoff';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import { POSTER_GOAL_ARCHETYPES } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  POSTER_ARCHETYPE_IDS,
  POSTER_GOALS,
  normalizePosterSpec,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Props = {
  onPublish: (payload: { blob: Blob; mediaType: 'image' | 'video' }) => void;
  /** Post → open the saved design in the Posts editor. */
  onOpenInDesign: (templateId: string) => void;
};

const POST_ASPECT: Record<string, string> = {
  'instagram-portrait': '4 / 5',
  'instagram-post': '1 / 1',
  'instagram-story': '9 / 16',
  'facebook-post': '40 / 21',
};

function ratioToAspect(ratio: string): string {
  const [w, h] = ratio.split(':');
  return w && h ? `${w} / ${h}` : '1 / 1';
}

function isPosterGoal(value: unknown): value is PosterGoal {
  return (POSTER_GOALS as readonly unknown[]).includes(value);
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name.replace(/[^\w.-]+/g, '-');
  link.click();
  // Revoking in the same tick can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load the file');
  return response.blob();
}

/**
 * One AI Studio creation. Before the first generate: step 2 (describe it). After: the
 * conversation, with every version in the thread on the left, the picked version
 * large on the right, and a message box to keep changing it.
 */
export function AiStudioConversation({ onPublish, onOpenInDesign }: Props) {
  const { item, aiOutput, replaceDraftWithItem, closeItem, startDraft, startAiSession, active } =
    useMarketingTheme();
  const isBelowLg = useIsBelowLg();
  const { open: openUpgradeModal } = useUpgradeModal();
  const { canPublish } = useMarketingPermissions();
  const access = useAiOutputAccess();
  const premium = useAiPremiumFlags();
  const postGate = useFeatureGate('aiMarketingGeneration');
  const imageGate = useFeatureGate('aiMarketingImageGeneration');
  const videoGate = useFeatureGate('aiMarketingVideoGeneration');
  const planAllowed: Record<AiStudioOutput, boolean> = {
    post: postGate.isLoading || postGate.allowed,
    image: imageGate.isLoading || imageGate.allowed,
    video: videoGate.isLoading || videoGate.allowed,
  };

  // ── Which conversation ────────────────────────────────────────────────────
  const urlSessionId = item.mode === 'saved' ? item.id : null;
  const [createdId, setCreatedId] = useState<string | null>(null);
  const sessionId = urlSessionId ?? createdId;
  const [newOutput, setNewOutput] = useState<AiStudioOutput>(aiOutput ?? 'image');
  useEffect(() => {
    if (aiOutput) setNewOutput(aiOutput);
  }, [aiOutput]);

  const sessionQuery = useAiSession(sessionId);
  const detail = sessionQuery.data;
  const output: AiStudioOutput = detail?.session.output ?? newOutput;
  const engine = useAiPosterEngine(detail?.session.themeKey ?? null);

  const [text, setText] = useState('');
  const [started, setStarted] = useState(false);
  const [pending, setPending] = useState<Array<AiPendingTurn & { awaitId?: string }>>([]);
  const [postWork, setPostWork] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AiVersion | null>(null);
  const [refineAspect, setRefineAspect] = useState<string | null>(null);
  const [refineCamera, setRefineCamera] = useState<VideoCameraMoveId | null>(null);

  const generate = useGenerateMarketingMedia();
  const savePosts = useSavePostVersions();
  const rename = useRenameAiSession();
  const deleteVersion = useDeleteAiVersion(sessionId);
  const deleteSessions = useDeleteAiSessions();
  const referencesQuery = useMarketingGenerationReferences();
  const uploadReference = useUploadMarketingGenerationReference();

  // A post is drawn and saved in this tab; leaving mid-way would lose it.
  useUnsavedChangesGuard({ isDirty: postWork, blocksOn: 'location' });

  const turns = useMemo(() => (detail ? buildAiTurns(detail) : []), [detail]);
  const versions = useMemo(() => flattenVersions(turns), [turns]);

  // Landed versions replace their pending placeholders.
  useEffect(() => {
    if (!detail) return;
    setPending((current) => {
      const next = current.filter(
        (turn) =>
          !turn.awaitId ||
          !(
            detail.jobs.some((job) => job.id === turn.awaitId) ||
            detail.postVersions.some((row) => row.turnId === turn.awaitId)
          )
      );
      return next.length === current.length ? current : next;
    });
  }, [detail]);

  // A new version arrived: put it on stage. A batch lands best-first, so show that one.
  const seenCount = useRef(0);
  useEffect(() => {
    const added = versions.length - seenCount.current;
    if (added > 0) {
      const next = added > 1 ? versions[versions.length - added] : latestVersion(turns);
      if (next) setSelectedKey(next.key);
    }
    seenCount.current = versions.length;
  }, [versions, turns]);

  const selected =
    versions.find((version) => version.key === selectedKey) ?? latestVersion(turns) ?? null;
  const selectedIndex = selected ? versions.indexOf(selected) : -1;
  const stagePending = pending.length > 0 ? pending[pending.length - 1]! : null;
  const anyInFlight = versions.some((version) => isVersionInFlight(version));
  const busy = pending.length > 0 || generate.isPending || savePosts.isPending || postWork;

  // ── Create (step 2 → first version) ───────────────────────────────────────
  const openCreated = useCallback(
    (id: string) => {
      setCreatedId(id);
      replaceDraftWithItem(id);
    },
    [replaceDraftWithItem]
  );

  const create = async (request: AiCreateRequest) => {
    setStarted(true);
    if (request.output === 'post') {
      const turn: AiPendingTurn = {
        key: 'create',
        output: 'post',
        prompt: request.prompt || null,
        note: request.prompt ? null : 'New post',
        count: 4,
        aspect: POST_ASPECT[request.format] ?? '4 / 5',
      };
      setPending([turn]);
      setPostWork(true);
      try {
        // Art direction is its own call: out of credits must raise the upgrade prompt.
        const batch = await engine.generateBatch(request).catch((error: Error) => {
          handleGenerationError(error);
          return null;
        });
        if (!batch) {
          setPending([]);
          setStarted(false);
          return;
        }
        if (!batch.aiDirected) toast.message('AI styling is busy. Showing quick layouts instead.');
        const rendered = [];
        for (const spec of batch.specs) {
          try {
            rendered.push(await engine.render(spec, batch.photoUrls, request.format));
          } catch {
            // One layout failing to draw drops only that layout.
          }
        }
        if (rendered.length === 0) throw new Error('Could not draw these posts. Try again.');
        const saved = await savePosts.mutateAsync({
          sessionId: null,
          prompt: request.prompt || null,
          themeKey: engine.themeKey,
          versions: rendered.map((post) => ({
            spec: post.spec as unknown as Record<string, unknown>,
            goal: request.goal,
            format: post.format,
            photoUrls: post.photoUrls,
            previewDataUrl: post.previewDataUrl,
          })),
        });
        setPending([]);
        openCreated(saved.session.id);
      } catch (error) {
        setPending([]);
        setStarted(false);
        const message = (error as Error).message;
        if (message && !/quota|credit/i.test(message)) toast.error(message);
      } finally {
        setPostWork(false);
      }
      return;
    }

    setPending([
      {
        key: 'create',
        output: request.output,
        prompt: request.prompt || null,
        note: request.prompt ? null : 'From your photo',
        count: 1,
        aspect: ratioToAspect(request.aspect),
      },
    ]);
    try {
      const { job } = await generate.mutateAsync({
        ...request.payload,
        ...(active ? { themeKey: active.key } : {}),
      });
      setPending((current) => current.map((turn) => ({ ...turn, awaitId: job.id })));
      if (job.sessionId) openCreated(job.sessionId);
    } catch (error) {
      const failed = failedJobFromError(error);
      setPending([]);
      if (failed?.sessionId) {
        openCreated(failed.sessionId);
        return;
      }
      setStarted(false);
    }
  };

  // ── Refine / new versions ─────────────────────────────────────────────────
  const firstPrompt = turns.find((turn) => turn.prompt)?.prompt ?? '';
  const library = referencesQuery.data ?? [];

  const postSpecOf = useCallback(
    (version: Extract<AiVersion, { kind: 'post' }>): PosterSpec =>
      normalizePosterSpec(version.post.spec, {
        ...engine.baseFacts,
        photos:
          version.post.photoUrls.length > 0 ? version.post.photoUrls : engine.baseFacts.photos,
      }),
    [engine.baseFacts]
  );

  const savePostVersion = async (input: {
    parent: Extract<AiVersion, { kind: 'post' }>;
    prompt: string | null;
    note: string;
    run: () => Promise<{ spec: PosterSpec; photoUrls: string[]; format: DesignTemplateFormat }>;
  }) => {
    if (!sessionId) return false;
    const format = input.parent.post.format as DesignTemplateFormat;
    setPending([
      {
        key: `turn-${Date.now()}`,
        output: 'post',
        prompt: input.prompt,
        note: input.prompt ? null : input.note,
        count: 1,
        aspect: POST_ASPECT[format] ?? '4 / 5',
      },
    ]);
    setPostWork(true);
    try {
      // The AI call is its own step: out of credits raises the upgrade prompt.
      const next = await input.run().catch((error: Error) => {
        handleGenerationError(error);
        return null;
      });
      if (!next) return false;
      const rendered = await engine.render(next.spec, next.photoUrls, next.format);
      await savePosts.mutateAsync({
        sessionId,
        prompt: input.prompt,
        parentVersionId: input.parent.post.id,
        versions: [
          {
            spec: rendered.spec as unknown as Record<string, unknown>,
            goal: isPosterGoal(input.parent.post.goal) ? input.parent.post.goal : 'vibe',
            format: rendered.format,
            photoUrls: rendered.photoUrls,
            previewDataUrl: rendered.previewDataUrl,
          },
        ],
      });
      return true;
    } catch (error) {
      // The save mutation toasts its own failures; drawing errors land here.
      if (!(error instanceof GenerationRequestError)) {
        toast.error(friendlyToastError(error, 'Could not change this post. Try again.'));
      }
      return false;
    } finally {
      setPending([]);
      setPostWork(false);
    }
  };

  const refine = async (instruction: string): Promise<boolean> => {
    if (!selected || !sessionId) return false;
    if (!planAllowed[output]) {
      openUpgradeModal(OUTPUT_FEATURE[output]);
      return false;
    }
    if (selected.kind === 'post') {
      const parent = selected;
      return savePostVersion({
        parent,
        prompt: instruction,
        note: 'Changed',
        run: async () => {
          const revised = await engine.revise({
            spec: postSpecOf(parent),
            photoUrls: parent.post.photoUrls,
            goal: isPosterGoal(parent.post.goal) ? parent.post.goal : 'vibe',
            originalPrompt: firstPrompt,
            instruction,
          });
          return { ...revised, format: parent.post.format as DesignTemplateFormat };
        },
      });
    }
    return sendJob(selected.job, instruction);
  };

  /** Photo / clip: a new job in this conversation, refining `parent`. */
  const sendJob = async (parent: MarketingGenerationJob, instruction: string, retry = false) => {
    if (!sessionId) return false;
    const values = composerValuesFromJob(parent, library, {
      allowPremium:
        parent.mediaType === 'video' ? premium.allowPremiumVideo : premium.allowPremiumImage,
      allowHighResolution: planAllowed.video,
    });
    const isVideo = parent.mediaType === 'video';
    // Retrying a failed first version resends it as it was; anything else refines the
    // version on stage (photo: edits that image; clip: same start photo).
    const refinesParent = !(retry && !parent.parentJobId);
    const parentJobId = retry ? (parent.parentJobId ?? undefined) : parent.id;
    const aspectRatio = isVideo ? values.aspectRatio : (refineAspect ?? values.aspectRatio);
    const prompt = retry
      ? refinesParent
        ? values.prompt
        : composeGenerationPrompt(values.prompt, values.lookId)
      : instruction;
    setPending([
      {
        key: `turn-${Date.now()}`,
        output: parent.mediaType,
        prompt: retry ? values.prompt || null : instruction,
        note: null,
        count: 1,
        aspect: ratioToAspect(aspectRatio),
      },
    ]);
    try {
      const { job } = await generate.mutateAsync(
        isVideo
          ? {
              mediaType: 'video',
              prompt,
              sessionId,
              ...(parentJobId ? { parentJobId } : {}),
              qualityTier: values.qualityTier,
              aspectRatio,
              resolution: values.resolution,
              durationSeconds: DEFAULT_VIDEO_DURATION,
              referenceIds: refinesParent ? [] : values.references.map((row) => row.id),
              cameraMove: refineCamera ?? values.cameraMove,
              sound: values.sound,
              enhancePrompt: true,
            }
          : {
              mediaType: 'image',
              prompt,
              sessionId,
              ...(parentJobId ? { parentJobId } : {}),
              qualityTier: values.qualityTier,
              aspectRatio,
              imageSize: values.imageSize,
              referenceIds: refinesParent ? [] : values.references.map((row) => row.id),
              enhancePrompt: true,
            }
      );
      setPending((current) => current.map((turn) => ({ ...turn, awaitId: job.id })));
      return true;
    } catch {
      setPending([]);
      void sessionQuery.refetch();
      return false;
    }
  };

  const shuffle = (version: Extract<AiVersion, { kind: 'post' }>) => {
    const spec = postSpecOf(version);
    const goal = isPosterGoal(version.post.goal) ? version.post.goal : spec.goal;
    const used = new Set(
      versions.flatMap((item) => (item.kind === 'post' ? [String(item.post.spec.archetype)] : []))
    );
    const order = [...POSTER_GOAL_ARCHETYPES[goal], ...POSTER_ARCHETYPE_IDS];
    const archetype =
      order.find((id) => !used.has(id)) ??
      order[(order.indexOf(spec.archetype) + 1) % order.length]!;
    void savePostVersion({
      parent: version,
      prompt: null,
      note: 'New layout',
      run: async () => ({
        spec: {
          ...spec,
          archetype,
          // In a theme the type is the theme's; only the layout changes.
          fontPairing: detail?.session.themeKey
            ? spec.fontPairing
            : POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
        },
        photoUrls: version.post.photoUrls,
        format: version.post.format as DesignTemplateFormat,
      }),
    });
  };

  const resizePost = (
    version: Extract<AiVersion, { kind: 'post' }>,
    format: DesignTemplateFormat
  ) => {
    if (format === version.post.format) return;
    if (!POST_FORMATS.some((option) => option.value === format)) return;
    void savePostVersion({
      parent: version,
      prompt: null,
      note: `Resized to ${postFormatLabel(format)}`,
      run: async () => ({ spec: postSpecOf(version), photoUrls: version.post.photoUrls, format }),
    });
  };

  // ── Version actions ───────────────────────────────────────────────────────
  const withBusy = async (key: string, run: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await run();
    } catch (error) {
      toast.error(friendlyToastError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const blobFor = async (version: AiVersion): Promise<Blob> => {
    if (version.kind === 'post') {
      return engine.exportBlob(
        postSpecOf(version),
        version.post.photoUrls,
        version.post.format as DesignTemplateFormat
      );
    }
    if (!version.job.outputUrl) throw new Error('This version has no file yet');
    return fetchBlob(version.job.outputUrl);
  };

  const title = detail?.session.title ?? '';
  const download = (version: AiVersion) =>
    withBusy('download', async () => {
      const blob = await blobFor(version);
      const ext =
        version.kind === 'video'
          ? 'mp4'
          : version.kind === 'post'
            ? 'png'
            : (blob.type.split('/')[1] ?? 'jpg');
      downloadBlob(blob, `${title || AI_OUTPUT_LABEL[output].one}-v${version.number}.${ext}`);
    });

  const publish = (version: AiVersion) =>
    withBusy('publish', async () => {
      onPublish({
        blob: await blobFor(version),
        mediaType: version.kind === 'video' ? 'video' : 'image',
      });
    });

  const editInPosts = (version: Extract<AiVersion, { kind: 'post' }>) =>
    withBusy('edit', async () => {
      const id = await engine.saveToPosts({
        spec: postSpecOf(version),
        photoUrls: version.post.photoUrls,
        format: version.post.format as DesignTemplateFormat,
        name: title || 'AI post',
        previewUrl: version.post.previewUrl,
      });
      onOpenInDesign(id);
    });

  const putInPost = (job: MarketingGenerationJob) => {
    if (!job.outputUrl) return;
    setPendingMarketingPhoto(job.outputUrl);
    startDraft({ kind: 'blank' }, { tab: 'design', size: 'instagram-post' });
  };

  const makeClip = (job: MarketingGenerationJob) =>
    withBusy('clip', async () => {
      if (!job.outputUrl) return;
      const blob = await fetchBlob(job.outputUrl);
      const file = new File([blob], fileNameForGeneratedReference(job), {
        type: blob.type || job.outputMimeType || 'image/jpeg',
      });
      const reference = await uploadReference.mutateAsync(file);
      setPendingAiStartPhoto(reference);
      startAiSession('video');
    });

  // ── Render ────────────────────────────────────────────────────────────────
  const showCreate = item.mode === 'draft' && !started && !createdId;
  const notFound = sessionQuery.isError && !detail;

  if (showCreate) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ConversationTopBar
          title={`New ${AI_OUTPUT_LABEL[newOutput].one.toLowerCase()}`}
          onBack={closeItem}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-6 lg:overflow-hidden lg:p-0">
          <AiStudioCreate
            output={newOutput}
            onOutputChange={(next) => {
              setNewOutput(next);
              startAiSession(next, { replace: true });
            }}
            onSubmit={(request) => void create(request)}
            busy={busy}
            canStart={access[newOutput]}
            planAllowed={planAllowed[newOutput]}
            allowPremium={
              newOutput === 'video' ? premium.allowPremiumVideo : premium.allowPremiumImage
            }
            allowHighResolution={planAllowed.video}
            text={text}
            onTextChange={setText}
          />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ConversationTopBar title="" onBack={closeItem} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-medium">This creation could not be opened.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => void sessionQuery.refetch()}
            >
              Try again
            </Button>
            <Button type="button" className="min-h-[44px]" onClick={closeItem}>
              Back to AI Studio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const deleted = Boolean(detail?.session.deletedAt);
  const usable = isVersionUsable(selected);
  const canChange = access[output] && !deleted;

  const actionGroups: ResponsiveOverflowAction[][] = [];
  if (selected?.kind === 'post') {
    actionGroups.push([
      {
        key: 'shuffle',
        label: 'Try another layout',
        icon: <Shuffle className="size-4" aria-hidden />,
        disabled: busy || !canChange,
        onSelect: () => shuffle(selected),
      },
    ]);
  }
  if (selected?.kind === 'image') {
    actionGroups.push([
      {
        key: 'use-in-post',
        label: 'Use in a post',
        icon: <LayoutTemplate className="size-4" aria-hidden />,
        disabled: !usable,
        onSelect: () => putInPost(selected.job),
      },
      ...(access.video
        ? [
            {
              key: 'make-clip',
              label: 'Make a clip from this',
              icon: <Clapperboard className="size-4" aria-hidden />,
              disabled: !usable || busyAction !== null,
              onSelect: () => void makeClip(selected.job),
            },
          ]
        : []),
    ]);
  }
  if (
    selected &&
    selected.kind !== 'post' &&
    selected.job.promptEnhanced &&
    selected.job.enhancedPrompt
  ) {
    const enhanced = selected.job.enhancedPrompt;
    actionGroups.push([
      {
        key: 'copy',
        label: 'Copy improved description',
        icon: <Copy className="size-4" aria-hidden />,
        onSelect: () =>
          void navigator.clipboard
            .writeText(enhanced)
            .then(() => toast.success('Description copied'))
            .catch(() => toast.error('Could not copy the description')),
      },
    ]);
  }
  if (selected && canChange) {
    actionGroups.push([
      {
        key: 'delete',
        label: versions.length <= 1 ? 'Delete creation' : 'Delete this version',
        destructive: true,
        icon: <Trash2 className="size-4" aria-hidden />,
        disabled: isVersionInFlight(selected),
        onSelect: () => setConfirmDelete(selected),
      },
    ]);
  }

  const topActions = selected ? (
    <div className="flex items-center gap-1.5">
      {selected.kind === 'post' && canChange ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] gap-2 max-sm:px-3 lg:min-h-9"
          disabled={busyAction !== null}
          onClick={() => void editInPosts(selected)}
        >
          {busyAction === 'edit' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <PenLine className="size-4" aria-hidden />
          )}
          <span className="max-sm:sr-only">Edit in Posts</span>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 lg:size-9"
        disabled={!usable || busyAction !== null}
        onClick={() => void download(selected)}
        aria-label="Download"
      >
        {busyAction === 'download' ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
      </Button>
      {canPublish ? (
        <Button
          type="button"
          className="min-h-[44px] gap-2 max-sm:px-3 lg:min-h-9"
          disabled={!usable || busyAction !== null}
          onClick={() => void publish(selected)}
        >
          {busyAction === 'publish' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          <span className="max-sm:sr-only">Publish</span>
        </Button>
      ) : null}
      {actionGroups.length > 0 ? (
        <ResponsiveOverflowMenu
          label="More actions"
          sheetTitle={`Version ${selected.number}`}
          actionGroups={actionGroups}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 lg:size-9"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          }
        />
      ) : null}
    </div>
  ) : null;

  const refineOptions =
    selected?.kind === 'post' && canChange ? (
      <SizeSelect
        choices={POST_FORMATS.map((option) => ({ ...option, value: option.value as string }))}
        value={selected.post.format}
        onChange={(value) => resizePost(selected, value as DesignTemplateFormat)}
        disabled={busy}
      />
    ) : selected?.kind === 'image' ? (
      <SizeSelect
        choices={IMAGE_ASPECT_RATIO_OPTIONS.map((option) => {
          const [w, h] = option.value.split(':').map(Number);
          return { value: option.value, label: option.label, width: w ?? 1, height: h ?? 1 };
        })}
        value={refineAspect ?? selected.job.aspectRatio}
        onChange={setRefineAspect}
        disabled={busy}
      />
    ) : selected?.kind === 'video' ? (
      <Select
        value={
          refineCamera ??
          (selected.job.generationOptions?.cameraMove as VideoCameraMoveId | undefined) ??
          'push-in'
        }
        onValueChange={(value) => {
          if (VIDEO_CAMERA_MOVES.some((move) => move.id === value)) {
            setRefineCamera(value as VideoCameraMoveId);
          }
        }}
        disabled={busy}
      >
        <SelectTrigger className="h-11 w-auto min-w-[8rem] lg:h-10" aria-label="Camera">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VIDEO_CAMERA_MOVES.map((move) => (
            <SelectItem key={move.id} value={move.id}>
              {move.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  const refineCost =
    selected && selected.kind !== 'post'
      ? (() => {
          const job = selected.job;
          const credits =
            job.mediaType === 'video'
              ? estimateGenerationCredits({
                  mediaType: 'video',
                  tier: job.qualityTier,
                  resolution: job.resolution === '1080p' ? '1080p' : '720p',
                  durationSeconds: DEFAULT_VIDEO_DURATION,
                })
              : estimateGenerationCredits({
                  mediaType: 'image',
                  tier: job.qualityTier,
                  imageSize: job.qualityTier === 'draft' ? '1K' : ((job.imageSize ?? '1K') as '1K'),
                });
          return `${credits.toLocaleString()} credits`;
        })()
      : null;

  const blockedReason = deleted
    ? 'Restore this creation to keep working on it'
    : !access[output]
      ? 'You do not have permission to change this'
      : anyInFlight
        ? 'Wait for this clip to finish'
        : selected && selected.kind === 'image' && !usable
          ? 'This version did not finish. Pick another one'
          : null;

  const refineBox = (
    <AiStudioRefineBox
      output={output}
      onSend={refine}
      busy={busy}
      blockedReason={
        versions.length === 0
          ? pending.length > 0
            ? 'Making your first version'
            : null
          : blockedReason
      }
      feature={OUTPUT_FEATURE[output]}
      costLabel={refineCost}
      options={refineOptions}
    />
  );

  const thread = (
    <AiStudioThread
      turns={turns}
      pending={pending}
      selectedKey={selected?.key ?? null}
      onSelect={(key) => {
        setSelectedKey(key);
        setHistoryOpen(false);
      }}
    />
  );

  const stage = (
    <AiStudioStage
      version={selected}
      pending={
        stagePending && (!selected || selectedIndex === versions.length - 1) ? stagePending : null
      }
      total={versions.length}
      onPrevious={
        selectedIndex > 0 ? () => setSelectedKey(versions[selectedIndex - 1]!.key) : undefined
      }
      onNext={
        selectedIndex >= 0 && selectedIndex < versions.length - 1
          ? () => setSelectedKey(versions[selectedIndex + 1]!.key)
          : undefined
      }
      canRetry={canChange && !busy}
      onRetry={
        selected && selected.kind !== 'post'
          ? () => void sendJob(selected.job, '', true)
          : undefined
      }
    />
  );

  const loadingFirst = sessionQuery.isLoading && !detail && pending.length === 0;
  const OutputIcon = AI_OUTPUT_ICON[output];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConversationTopBar
        title={title}
        icon={<OutputIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />}
        onBack={closeItem}
        onRename={
          canChange && sessionId
            ? (next) => rename.mutateAsync({ id: sessionId, title: next })
            : undefined
        }
        actions={topActions}
      />
      {loadingFirst ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4" aria-busy="true">
          <Skeleton className="min-h-[16rem] w-full flex-1 rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-12 shrink-0 rounded-lg" />
            ))}
          </div>
        </div>
      ) : isBelowLg ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-muted/40 flex min-h-0 flex-1 flex-col">{stage}</div>
          <div className="border-border space-y-2 border-t p-3">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {versions.map((version) => (
                  <VersionThumb
                    key={version.key}
                    version={version}
                    size="sm"
                    selected={version.key === selected?.key}
                    onSelect={() => setSelectedKey(version.key)}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] shrink-0 gap-1.5 px-3"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="size-4" aria-hidden />
                History
              </Button>
            </div>
            {refineBox}
          </div>
          <ResponsiveModal open={historyOpen} onOpenChange={setHistoryOpen}>
            <ResponsiveModalContent
              sheetLayout="split"
              className="flex max-h-[min(90dvh,40rem)] w-full flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 max-lg:h-[min(92dvh,40rem)] sm:p-0"
            >
              <ResponsiveModalHeader className="border-border shrink-0 border-b px-4 py-3 pr-12 sm:px-5">
                <ResponsiveModalTitle>History</ResponsiveModalTitle>
              </ResponsiveModalHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
                {thread}
              </div>
            </ResponsiveModalContent>
          </ResponsiveModal>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(20rem,22.5rem)_minmax(0,1fr)]">
          <aside className="border-border flex min-h-0 flex-col border-r" aria-label="Versions">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{thread}</div>
            <div className="border-border border-t p-3">{refineBox}</div>
          </aside>
          <section className="bg-muted/40 flex min-h-0 flex-col" aria-label="Preview">
            {stage}
          </section>
        </div>
      )}

      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {versions.length <= 1
                ? 'Delete this creation?'
                : `Delete version ${confirmDelete?.number}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {versions.length <= 1
                ? 'It moves to Recently deleted for 30 days.'
                : 'This version is removed for good. Posts you already published stay up.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (!target || !sessionId) return;
                if (versions.length <= 1) {
                  deleteSessions.mutate({ ids: [sessionId] }, { onSuccess: () => closeItem() });
                  return;
                }
                deleteVersion.mutate({
                  kind: target.kind,
                  id: target.kind === 'post' ? target.post.id : target.job.id,
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConversationTopBar({
  title,
  icon,
  onBack,
  onRename,
  actions,
}: {
  title: string;
  icon?: React.ReactNode;
  onBack: () => void;
  onRename?: (title: string) => Promise<unknown>;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card shrink-0 border-b">
      <div className="flex min-h-[52px] items-center gap-1 px-1.5 py-1 sm:gap-2 sm:px-3">
        <Button
          type="button"
          variant="ghost"
          className="min-h-[44px] shrink-0 gap-1 px-2"
          onClick={onBack}
          aria-label="Back to AI Studio"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="max-sm:sr-only">AI Studio</span>
        </Button>
        <span className="bg-border hidden h-5 w-px sm:block" aria-hidden />
        <div className="flex min-w-0 items-center gap-1.5">
          {icon}
          {title ? (
            <MarketingInlineName
              name={title}
              onRename={onRename}
              className="max-w-[min(22rem,45vw)]"
            />
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
        </div>
        <div className="ml-auto flex items-center">{actions}</div>
      </div>
    </div>
  );
}
