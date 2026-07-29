import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CaptureSection } from "./CaptureSection";
import { requestUploadUrl, uploadImageToStorage, extractImage } from "@/lib/api/images";
import type { UploadUrlResult } from "@/lib/api/images.types";
import type { ReviewPayload } from "@/lib/api/images.types";

vi.mock("@/lib/api/images", () => ({
  requestUploadUrl: vi.fn(),
  uploadImageToStorage: vi.fn(),
  extractImage: vi.fn(),
}));

const requestUploadUrlMock = vi.mocked(requestUploadUrl);
const uploadImageToStorageMock = vi.mocked(uploadImageToStorage);
const extractImageMock = vi.mocked(extractImage);

const sampleUploadTarget: UploadUrlResult = {
  image_id: "img-1",
  upload_url: "https://storage.example.com/signed-put-url?token=secret",
  object_path: "events/e1/cards/img-1.jpg",
  signed_token: "secret",
};

function renderSection(props: Partial<React.ComponentProps<typeof CaptureSection>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CaptureSection eventId="e1" {...props} />
    </QueryClientProvider>,
  );
}

function makeFile(name = "card.jpg", type = "image/jpeg", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function uploadBusinessCard(file: File = makeFile()) {
  fireEvent.change(screen.getByTestId("capture-image-business-card-input"), {
    target: { files: [file] },
  });
}

beforeEach(() => {
  requestUploadUrlMock.mockReset();
  uploadImageToStorageMock.mockReset();
  extractImageMock.mockReset();
  requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
  uploadImageToStorageMock.mockResolvedValue(undefined);
});

// Requirement: EIF-0001 AC1, AC2, AC3
describe("CaptureSection extraction lifecycle", () => {
  it("calls extractImage with the uploaded image_id once the upload succeeds", async () => {
    extractImageMock.mockResolvedValue({
      image_id: "img-1",
      fields: {},
      warnings: [],
      capture_method: "image",
      extraction_status: "completed",
    });

    renderSection();
    uploadBusinessCard();

    await waitFor(() => expect(extractImageMock).toHaveBeenCalledWith("img-1"));
  });

  it("shows a distinct 'Reading…' state while extraction is in flight", async () => {
    let resolveExtract: (value: ReviewPayload) => void = () => {};
    extractImageMock.mockImplementation(
      () =>
        new Promise<ReviewPayload>((resolve) => {
          resolveExtract = resolve;
        }),
    );

    renderSection();
    uploadBusinessCard();

    expect(await screen.findByText("Reading…")).toBeInTheDocument();

    resolveExtract({
      image_id: "img-1",
      fields: {},
      warnings: [],
      capture_method: "image",
      extraction_status: "completed",
    });

    await waitFor(() => expect(screen.queryByText("Reading…")).not.toBeInTheDocument());
  });
});

// Requirement: EIF-0001 AC4, AC5
describe("CaptureSection extraction failure/skip handling", () => {
  it("shows a non-blocking notice and does not remove the uploaded image on extraction failure (request error)", async () => {
    extractImageMock.mockRejectedValue(new Error("STORAGE_UNAVAILABLE"));

    renderSection();
    uploadBusinessCard();

    expect(await screen.findByText("Couldn't read card")).toBeInTheDocument();
    expect(
      screen.getByText("You can still enter the contact's details manually."),
    ).toBeInTheDocument();
    // Image upload success state remains visible — nothing was rolled back.
    expect(screen.getByTestId("capture-image-business-card-success")).toBeInTheDocument();
  });

  it("shows the same non-blocking notice for an in-band extraction_status: failed response", async () => {
    extractImageMock.mockResolvedValue({
      image_id: "img-1",
      fields: {},
      warnings: [],
      capture_method: "image",
      extraction_status: "failed",
    });

    renderSection();
    uploadBusinessCard();

    expect(
      await screen.findByText(
        "You can still enter the contact's details manually.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no error/loading notice for extraction_status: skipped", async () => {
    extractImageMock.mockResolvedValue({
      image_id: "img-1",
      fields: {},
      warnings: [],
      capture_method: "image",
      extraction_status: "skipped",
    });

    renderSection();
    uploadBusinessCard();

    await screen.findByTestId("capture-image-business-card-success");
    expect(screen.queryByText("Reading…")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "You can still enter the contact's details manually.",
      ),
    ).not.toBeInTheDocument();
  });
});

// Requirement: EIF-0001 AC3
describe("CaptureSection extraction success indicator", () => {
  it("shows a success indicator with a review prompt when fields were found", async () => {
    extractImageMock.mockResolvedValue({
      image_id: "img-1",
      fields: { first_name: { value: "Ada", source: "ai" } },
      warnings: [],
      capture_method: "image",
      extraction_status: "completed",
    });

    renderSection();
    uploadBusinessCard();

    expect(await screen.findByText("Extracted")).toBeInTheDocument();
    expect(screen.getByText("Review and edit the fields before saving.")).toBeInTheDocument();
  });

  it("shows a distinct success message when extraction completed but found no fields", async () => {
    extractImageMock.mockResolvedValue({
      image_id: "img-1",
      fields: {},
      warnings: [],
      capture_method: "image",
      extraction_status: "completed",
    });

    renderSection();
    uploadBusinessCard();

    expect(await screen.findByText("No fields found")).toBeInTheDocument();
    expect(
      screen.getByText("No fields were found — enter the contact's details manually."),
    ).toBeInTheDocument();
  });
});

// Requirement: EIF-0001 AC6
describe("CaptureSection warnings", () => {
  it("renders warnings returned by extraction without blocking anything else", async () => {
    extractImageMock.mockResolvedValue({
      image_id: "img-1",
      fields: {},
      warnings: ["Card was partially blurry"],
      capture_method: "image",
      extraction_status: "completed",
    });

    renderSection();
    uploadBusinessCard();

    expect(await screen.findByText("Card was partially blurry")).toBeInTheDocument();
  });
});

// Regression test: isEmpty() only looks at manual field values and a
// *finished* upload's imageId — while the business-card upload is still in
// flight, a caller relying solely on isEmpty() would wrongly treat the
// section as unused and submit without it, abandoning the upload. Callers
// must also gate on this callback.
describe("CaptureSection upload-in-progress reporting", () => {
  it("reports upload-pending while the business card image is still uploading, then clears it once the upload settles", async () => {
    let resolveUpload: () => void = () => {};
    uploadImageToStorageMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    extractImageMock.mockResolvedValue({
      image_id: "img-1",
      fields: {},
      warnings: [],
      capture_method: "image",
      extraction_status: "completed",
    });
    const onUploadPendingChange = vi.fn();

    renderSection({ onUploadPendingChange });
    uploadBusinessCard();

    await waitFor(() => expect(onUploadPendingChange).toHaveBeenCalledWith(true));

    resolveUpload();

    await waitFor(() => expect(onUploadPendingChange).toHaveBeenLastCalledWith(false));
  });
});

// Requirement: EIF-0002 AC5
describe("CaptureSection image replace", () => {
  it("resets to a fresh pending extraction when the business card image is replaced", async () => {
    let resolveFirst: (value: ReviewPayload) => void = () => {};
    extractImageMock.mockImplementationOnce(
      () =>
        new Promise<ReviewPayload>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    renderSection();
    uploadBusinessCard(makeFile("first.jpg"));
    await screen.findByText("Reading…");

    resolveFirst({
      image_id: "img-1",
      fields: { first_name: { value: "Ada", source: "ai" } },
      warnings: [],
      capture_method: "image",
      extraction_status: "completed",
    });
    await waitFor(() => expect(screen.queryByText("Reading…")).not.toBeInTheDocument());

    // Replace with a new image — a distinct image_id from a second signed URL.
    requestUploadUrlMock.mockResolvedValueOnce({ ...sampleUploadTarget, image_id: "img-2" });
    extractImageMock.mockImplementationOnce(() => new Promise<ReviewPayload>(() => {}));

    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    uploadBusinessCard(makeFile("second.jpg"));

    expect(await screen.findByText("Reading…")).toBeInTheDocument();
    expect(extractImageMock).toHaveBeenLastCalledWith("img-2");
  });
});
