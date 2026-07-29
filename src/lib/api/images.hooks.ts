// Requirements: CAP-0006 AC3, AC4; CAP-0007 AC1, AC2
// React Query wrapper composing requestUploadUrl + uploadImageToStorage
// (images.ts) into a single mutation, plus the progress/abort state neither
// of those functions owns on their own — mirrors events.hooks.ts's pattern
// of being the one place capture UI code reaches for upload state instead
// of hand-rolled useState/useEffect.
import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { confirmImage, extractImage, requestUploadUrl, uploadImageToStorage } from "./images";
import type { CreateEventContactResult } from "./contacts.types";
import type { ConfirmRequest, ReviewPayload, UploadUrlResult } from "./images.types";

export interface UploadImageVariables {
  file: File;
  contentType: "image/jpeg" | "image/png";
}

// Not event-scoped (Task 7 real-backend verification — requestUploadUrl
// takes no eventId; see images.ts).
export function useUploadImageMutation() {
  const [progress, setProgress] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ file, contentType }: UploadImageVariables): Promise<UploadUrlResult> => {
      setProgress(0);
      const controller = new AbortController();
      controllerRef.current = controller;

      const uploadTarget = await requestUploadUrl(contentType, file.size);
      await uploadImageToStorage(uploadTarget.upload_url, file, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      return uploadTarget;
    },
  });

  // CAP-0007 AC2: abort the in-flight direct-to-storage PUT; the mutation
  // settles into its error state, which callers use to reset to the
  // pre-upload picker without submitting a partial image.
  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { ...mutation, progress, abort };
}

// EIF-0001 AC1: run extraction against an already-uploaded image. No
// query-key caching needed — a mutation-only call, same pattern as
// contacts.hooks.ts's useResolveContactMutation.
export function useExtractImageMutation() {
  return useMutation({
    mutationFn: (imageId: string): Promise<ReviewPayload> => extractImage(imageId),
  });
}

// EIF-0003 AC1, AC3: persist the contact via the image-confirm pipeline.
export function useConfirmImageMutation() {
  return useMutation({
    mutationFn: ({
      imageId,
      input,
      idempotencyKey,
    }: {
      imageId: string;
      input: ConfirmRequest;
      idempotencyKey: string;
    }): Promise<CreateEventContactResult> => confirmImage(imageId, input, idempotencyKey),
  });
}
