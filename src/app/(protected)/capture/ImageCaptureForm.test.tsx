import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ImageCaptureForm } from "./ImageCaptureForm";
import { requestUploadUrl, uploadImageToStorage } from "@/lib/api/images";
import type { UploadUrlResult } from "@/lib/api/images.types";

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

function renderForm(props: Partial<React.ComponentProps<typeof ImageCaptureForm>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImageCaptureForm {...props} />
    </QueryClientProvider>,
  );
}

function makeFile(name = "card.jpg", type = "image/jpeg", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

beforeEach(() => {
  requestUploadUrlMock.mockReset();
  uploadImageToStorageMock.mockReset();
});

// Composition-level coverage only — per-field behavior (validation, upload,
// progress, cancel, retry) is covered by ImageDropzoneField.test.tsx, which
// both fields here are instances of.
describe("ImageCaptureForm", () => {
  it("renders a required Business card image field and an optional Selfie Image field", () => {
    renderForm();

    expect(screen.getByTestId("capture-image-business-card-input")).toBeInTheDocument();
    expect(screen.getByTestId("capture-image-selfie-input")).toBeInTheDocument();
  });

  it("keeps the two fields independent — uploading the business card doesn't affect the selfie field", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockResolvedValue(undefined);

    renderForm();
    fireEvent.change(screen.getByTestId("capture-image-business-card-input"), {
      target: { files: [makeFile()] },
    });

    expect(
      await screen.findByTestId("capture-image-business-card-success"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("capture-image-selfie-success")).not.toBeInTheDocument();
    expect(requestUploadUrlMock).toHaveBeenCalledTimes(1);
  });

  // Requirement: EIF-0001 AC1
  it("forwards onBusinessCardUploaded only to the business-card field, not the selfie field", async () => {
    requestUploadUrlMock.mockResolvedValue(sampleUploadTarget);
    uploadImageToStorageMock.mockResolvedValue(undefined);
    const onBusinessCardUploaded = vi.fn();

    renderForm({ onBusinessCardUploaded });
    fireEvent.change(screen.getByTestId("capture-image-business-card-input"), {
      target: { files: [makeFile()] },
    });

    await screen.findByTestId("capture-image-business-card-success");
    expect(onBusinessCardUploaded).toHaveBeenCalledTimes(1);
    expect(onBusinessCardUploaded).toHaveBeenCalledWith("img-1");

    fireEvent.change(screen.getByTestId("capture-image-selfie-input"), {
      target: { files: [makeFile("selfie.jpg")] },
    });
    await screen.findByTestId("capture-image-selfie-success");
    // Still only the one call from the business-card upload above.
    expect(onBusinessCardUploaded).toHaveBeenCalledTimes(1);
    expect(onBusinessCardUploaded).toHaveBeenCalledWith("img-1");
  });
});
