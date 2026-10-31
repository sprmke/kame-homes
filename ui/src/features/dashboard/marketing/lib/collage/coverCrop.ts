/**
 * Center cover-crop maths shared by the org-logo circle and every collage cell:
 * pick the largest centered rect of the source image's aspect that fully fills
 * a `frameWidth`×`frameHeight` frame, expressed as normalized 0–1 crop values
 * (Polotno's `cropX/cropY/cropWidth/cropHeight`).
 */
export function coverCropForFrame(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number
): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } {
  const fullCrop = { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 };
  if (naturalWidth <= 0 || naturalHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return fullCrop;
  }

  const sourceRatio = naturalWidth / naturalHeight;
  const frameRatio = frameWidth / frameHeight;

  if (Math.abs(sourceRatio - frameRatio) < 1e-6) {
    return fullCrop;
  }

  if (sourceRatio > frameRatio) {
    // Source is relatively wider than the frame — crop its left/right edges.
    const cropWidth = frameRatio / sourceRatio;
    return { cropX: (1 - cropWidth) / 2, cropY: 0, cropWidth, cropHeight: 1 };
  }

  // Source is relatively taller than the frame — crop its top/bottom edges.
  const cropHeight = sourceRatio / frameRatio;
  return { cropX: 0, cropY: (1 - cropHeight) / 2, cropWidth: 1, cropHeight };
}
