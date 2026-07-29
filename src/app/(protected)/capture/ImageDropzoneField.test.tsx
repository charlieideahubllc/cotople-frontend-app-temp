import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ImageDropzoneField } from "./ImageDropzoneField";
import { requestUploadUrl, uploadImageToStorage } from "@/lib/api/images";
import type { UploadUrlResult } from "@/lib/api/images.types";
import type { UploadImageOptions } from "@/lib/api/images";

// images.hooks.ts imports these via a relative "./images" specifier that
// resolves to the same module as "@/lib/api/images" — mocking by this path
// intercepts it, same pattern as EventList.test.tsx mocking "@/lib/api/events"
// even though EventList itself only touches events.hooks.ts.
vi.mock("@/lib/api/images", () => ({
  requestUploadUrl: vi.fn(),
  uploadImageToStorage: vi.fn(),
}));

const requestUploadUrlMock = vi.mocked(requestUploadUrl);
const uploadImageToStorageMock = vi.mocked(uploadImageToStorage);

const sampleUploadTarget: UploadUrlResult = {
  image_id: "img-1",
  upload_url: "https://storage.example.com/signed-put-url?token=secret",
  object_path: "events/e1/cards/img-1.jpg",
  signed_token: "secret",
};

function renderField(props: Partial<React.ComponentProps<typeof ImageDropzoneField>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImageDropzoneField
        id="capture-image-business-card"
        label="Business card image"
        required
        dropText="Drag and drop a business card image here"
        {...props}
      />
    </QueryClientProvider>,
  );
}

function makeFile(name = "card.jpg", type = "image/jpeg", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function selectFile(file: File, testId = "capture-image-business-card-input") {
  const input = screen.getByTestId(testId) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  requestUploadUrlMock.mockReset();
  uploadImageToStorageMock.mockReset();
});

// Requirement: CAP-0006 AC1, AC2
describe("ImageDropzoneField client-side validation", () => {
  it("rejects an oversize file before any network call, with the exact SRS message", async () => {
    renderField();
    selectFile(makeFile("card.jpg", "image/jpeg", 6 * 1024 * 1024));

    expect(
      await screen.findByText("This image is larger than 5 MB. Choose a smaller JPEG or PNG."),
    ).toBeInTheDocument();
    expect(requestUploadUrlMock).not.toHaveBeenCalled();
    expect(uploadImageToStorageMock).not.toHaveBeenCalled();
  });

  it("rejects a non-JPEG/PNG file before any network call", async () => {
    renderField();
    selectFile(makeFile("card.pdf", "application/pdf"));

    expect(await screen.findByText("Choose a JPEG or PNG image.")).toBeInTheDocument();
    expect(requestUploadUrlMock).not.toHaveBeenCalled();
  });
});

// Requirement: CAP-0006 AC3, AC4, AC6, AC7; CAP-0007 AC1
describe("ImageDropzoneField upload flow", () => {
  it("requests a signed URL then uploads, showing a success confirmation with no bucket URL exposed", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockResolvedValue(undefined);

    const { container } = renderField();
    selectFile(makeFile());

    await waitFor(() =>
      expect(requestUploadUrlMock).toHaveBeenCalledWith("image/jpeg", expect.any(Number)),
    );
    expect(await screen.findByTestId("capture-image-business-card-success")).toBeInTheDocument();
    expect(screen.getByText(/img-1/)).toBeInTheDocument();
    // CAP-0006 AC6: no unauthenticated bucket URL displayed anywhere.
    expect(container.textContent).not.toContain(sampleUploadTarget.upload_url);
  });

  it("shows a progress indicator reflecting reported upload progress", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    let resolveUpload: () => void = () => {};
    uploadImageToStorageMock.mockImplementation(
      (_url: string, _file: File, opts?: UploadImageOptions) =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
          opts?.onProgress?.(40);
        }),
    );

    renderField();
    selectFile(makeFile());

    await waitFor(() => expect(screen.getByText(/40%/)).toBeInTheDocument());

    resolveUpload();
    expect(await screen.findByTestId("capture-image-business-card-success")).toBeInTheDocument();
  });
});

// Requirement: CAP-0007 AC2
describe("ImageDropzoneField cancel", () => {
  it("returns to the picker state without submitting a partial image", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockImplementation(() => new Promise<void>(() => {})); // never resolves

    renderField();
    selectFile(makeFile());

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("capture-image-business-card-success")).not.toBeInTheDocument();
  });
});

// Requirement: CAP-0007 AC3
describe("ImageDropzoneField retry", () => {
  it("re-uploads the already-selected file without requiring re-selection", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockRejectedValueOnce(new Error("network error"));
    uploadImageToStorageMock.mockResolvedValueOnce(undefined);

    renderField();
    selectFile(makeFile());

    await screen.findByText("The upload failed. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("capture-image-business-card-success")).toBeInTheDocument();
    expect(uploadImageToStorageMock).toHaveBeenCalledTimes(2);
    expect(requestUploadUrlMock).toHaveBeenCalledTimes(2);
  });
});

// Requirement: EIF-0001 AC1
describe("ImageDropzoneField onUploadSuccess", () => {
  it("fires once with the image_id when the upload succeeds", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockResolvedValue(undefined);
    const onUploadSuccess = vi.fn();

    renderField({ onUploadSuccess });
    selectFile(makeFile());

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledTimes(1));
    expect(onUploadSuccess).toHaveBeenCalledWith("img-1");
  });

  it("does not fire on a failed upload", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockRejectedValue(new Error("network error"));
    const onUploadSuccess = vi.fn();

    renderField({ onUploadSuccess });
    selectFile(makeFile());

    await screen.findByText("The upload failed. Try again.");
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });

  it("does not fire when the upload is cancelled", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockImplementation(() => new Promise<void>(() => {})); // never resolves
    const onUploadSuccess = vi.fn();

    renderField({ onUploadSuccess });
    selectFile(makeFile());

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument(),
    );
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });
});

// Regression test: a parent (CaptureSection) needs to know an upload is
// still in flight even before onUploadSuccess fires, so it can block
// submission rather than silently proceeding without the image.
describe("ImageDropzoneField onUploadPendingChange", () => {
  it("reports true while uploading and false once the upload succeeds", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    let resolveUpload: () => void = () => {};
    uploadImageToStorageMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const onUploadPendingChange = vi.fn();

    renderField({ onUploadPendingChange });
    selectFile(makeFile());

    await waitFor(() => expect(onUploadPendingChange).toHaveBeenCalledWith(true));

    resolveUpload();

    await waitFor(() => expect(onUploadPendingChange).toHaveBeenLastCalledWith(false));
  });

  it("reports false again once a cancelled upload returns to the picker state", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockImplementation(() => new Promise<void>(() => {})); // never resolves
    const onUploadPendingChange = vi.fn();

    renderField({ onUploadPendingChange });
    selectFile(makeFile());

    await waitFor(() => expect(onUploadPendingChange).toHaveBeenCalledWith(true));

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(onUploadPendingChange).toHaveBeenLastCalledWith(false));
  });
});

describe("ImageDropzoneField required/optional label", () => {
  it("shows a required marker when required", () => {
    renderField({ required: true });
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows an (Optional) marker when not required", () => {
    renderField({ id: "capture-image-selfie", label: "Selfie Image", required: false });
    expect(screen.getByText("(Optional)")).toBeInTheDocument();
  });
});
