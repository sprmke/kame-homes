import React, { useRef, useCallback, useState, useMemo } from 'react';

import { Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { useCalendarPropertyMedia } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarPropertyMediaProvider';
import { PropertyImagePicker } from '@/features/dashboard/marketing/components/shared/PropertyImagePicker';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ColorPicker } from './ColorPicker';
import { NumberSlider } from './NumberSlider';
import { type BackgroundConfig } from '../../types';

interface BackgroundControlProps {
  label?: string;
  value: BackgroundConfig;
  onChange: (value: BackgroundConfig) => void;
}

const BACKGROUND_TYPES = [
  { value: 'solid', label: 'Solid Color' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'image', label: 'Image' },
];

const GRADIENT_TYPES = [
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
];

const PATTERN_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'lines', label: 'Lines' },
  { value: 'diagonal', label: 'Diagonal' },
];

// Helper to get image URL from either old or new format
function getImageUrl(config: BackgroundConfig): string | undefined {
  return config.imageUrl || config.image?.url;
}

// Helper to determine image source type
function getImageSourceType(
  config: BackgroundConfig,
  propertyUrls: Set<string>
): 'property' | 'upload' | 'custom' {
  const url = getImageUrl(config);
  if (!url) return 'property';
  if (url.startsWith('data:')) return 'upload';
  if (propertyUrls.has(url)) return 'property';
  return 'custom';
}

function syncImageObject(
  config: BackgroundConfig,
  updates: Partial<BackgroundConfig>
): BackgroundConfig {
  const next = { ...config, ...updates };
  if (updates.imageUrl === undefined) return next;

  const url = updates.imageUrl ?? '';
  if (!url) {
    next.image = undefined;
    return next;
  }

  next.image = {
    url,
    size: (updates.imageSize ?? config.imageSize ?? config.image?.size ?? 'cover') as
      'cover' | 'contain' | 'auto',
    position: updates.imagePosition ?? config.imagePosition ?? config.image?.position ?? 'center',
    repeat: config.image?.repeat ?? 'no-repeat',
    opacity: config.image?.opacity ?? config.opacity ?? 1,
  };
  return next;
}

// Image Source Selector Component
function ImageSourceSelector({
  value,
  updateBackground,
  propertyImages,
}: {
  value: BackgroundConfig;
  updateBackground: (updates: Partial<BackgroundConfig>) => void;
  propertyImages: ReturnType<typeof useCalendarPropertyMedia>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentImageUrl = getImageUrl(value);
  const propertyUrls = useMemo(
    () => new Set(propertyImages.map((item) => item.url)),
    [propertyImages]
  );

  const derivedSource = currentImageUrl ? getImageSourceType(value, propertyUrls) : 'property';
  const [selectedSourceOverride, setSelectedSourceOverride] = useState<
    'property' | 'upload' | 'custom' | null
  >(null);
  const selectedSource = selectedSourceOverride ?? derivedSource;

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        updateBackground({
          imageUrl: dataUrl,
          imageSize: value.imageSize || 'cover',
          imagePosition: value.imagePosition || 'center',
        });
        toast.success('Image uploaded successfully');
      };
      reader.onerror = () => {
        toast.error('Failed to read image file');
      };
      reader.readAsDataURL(file);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [value.imageSize, value.imagePosition, updateBackground]
  );

  const handleClearImage = useCallback(() => {
    updateBackground({
      imageUrl: '',
      imageSize: 'cover',
      imagePosition: 'center',
    });
  }, [updateBackground]);

  return (
    <div className="space-y-4">
      {/* Image Source Selection */}
      <RadioGroup
        value={selectedSource}
        onValueChange={(v) => {
          const newSource = v as 'property' | 'upload' | 'custom';
          setSelectedSourceOverride(newSource);

          if (newSource === 'property' && currentImageUrl && !propertyUrls.has(currentImageUrl)) {
            const defaultImage = propertyImages[0];
            if (!defaultImage) return;
            updateBackground({
              imageUrl: defaultImage.url,
              imageSize: value.imageSize || 'cover',
              imagePosition: value.imagePosition || 'center',
            });
          }
        }}
        className="flex flex-wrap gap-3"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="property" id="bg-property" />
          <Label htmlFor="bg-property" className="cursor-pointer text-xs font-normal">
            Property
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="upload" id="bg-upload" />
          <Label htmlFor="bg-upload" className="cursor-pointer text-xs font-normal">
            Upload
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="bg-custom" />
          <Label htmlFor="bg-custom" className="cursor-pointer text-xs font-normal">
            URL
          </Label>
        </div>
      </RadioGroup>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {selectedSource === 'property' && (
        <div className="min-w-0 space-y-2">
          <PropertyImagePicker
            images={propertyImages}
            selectedUrl={currentImageUrl ?? null}
            columns={2}
            onSelect={(url) =>
              updateBackground({
                imageUrl: url,
                imageSize: value.imageSize || 'cover',
                imagePosition: value.imagePosition || 'center',
              })
            }
          />
        </div>
      )}

      {/* Upload Section */}
      {selectedSource === 'upload' && (
        <div className="space-y-3">
          {currentImageUrl && currentImageUrl.startsWith('data:') ? (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Uploaded Image</Label>
              <div className="border-border relative aspect-video overflow-hidden rounded-md border">
                <img src={currentImageUrl} alt="Uploaded" className="h-full w-full object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={handleClearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Replace Image
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-muted-foreground/25 bg-muted/50 hover:border-primary/50 hover:bg-muted flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors"
            >
              <div className="bg-primary/10 rounded-full p-3">
                <Upload className="text-primary h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-muted-foreground text-xs">PNG, JPG, WebP (max 5MB)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom URL Input */}
      {selectedSource === 'custom' && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Image URL</Label>
          <div className="flex gap-2">
            <Input
              value={currentImageUrl || ''}
              onChange={(e) =>
                updateBackground({
                  imageUrl: e.target.value,
                  imageSize: value.imageSize || 'cover',
                  imagePosition: value.imagePosition || 'center',
                })
              }
              placeholder="https://example.com/image.jpg"
              className="h-9"
            />
          </div>
          <p className="text-muted-foreground text-xs">Enter a URL to any image (PNG, JPG, WebP)</p>
          {currentImageUrl && !currentImageUrl.startsWith('data:') && (
            <div className="border-border relative aspect-video w-80 overflow-hidden rounded-md border">
              <img
                src={currentImageUrl}
                alt="Preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Image Controls - shown when any image is selected */}
      {currentImageUrl && (
        <>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Size</Label>
            <Select
              value={value.imageSize || 'cover'}
              onValueChange={(v) =>
                updateBackground({
                  imageSize: v as 'cover' | 'contain' | 'auto',
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover (Fill)</SelectItem>
                <SelectItem value="contain">Contain (Fit)</SelectItem>
                <SelectItem value="auto">Auto (Original)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Position</Label>
            <Select
              value={value.imagePosition || 'center'}
              onValueChange={(v) =>
                updateBackground({
                  imagePosition: v,
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="top left">Top Left</SelectItem>
                <SelectItem value="top right">Top Right</SelectItem>
                <SelectItem value="bottom left">Bottom Left</SelectItem>
                <SelectItem value="bottom right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <NumberSlider
            label="Opacity"
            value={value.opacity ?? 1}
            onChange={(opacity) =>
              updateBackground({
                opacity,
              })
            }
            min={0}
            max={1}
            step={0.05}
            unit=""
          />

          {/* Overlay Color for readability */}
          <ColorPicker
            label="Overlay Tint (optional)"
            value={value.overlay || 'rgba(255,255,255,0.8)'}
            onChange={(overlay) => updateBackground({ overlay })}
          />
        </>
      )}
    </div>
  );
}

export function BackgroundControl({ label, value, onChange }: BackgroundControlProps) {
  const propertyImages = useCalendarPropertyMedia();

  const updateBackground = (updates: Partial<BackgroundConfig>) => {
    onChange(syncImageObject(value, updates));
  };

  const addGradientStop = () => {
    if (!value.gradient) return;

    const newStops = [...value.gradient.stops];
    const lastStop = newStops[newStops.length - 1];
    newStops.push({
      color: lastStop?.color || '#ffffff',
      position: Math.min((lastStop?.position || 0) + 25, 100),
    });

    updateBackground({
      gradient: { ...value.gradient, stops: newStops },
    });
  };

  const removeGradientStop = (index: number) => {
    if (!value.gradient || value.gradient.stops.length <= 2) return;

    const newStops = value.gradient.stops.filter((_, i) => i !== index);
    updateBackground({
      gradient: { ...value.gradient, stops: newStops },
    });
  };

  const updateGradientStop = (
    index: number,
    updates: Partial<{ color: string; position: number }>
  ) => {
    if (!value.gradient) return;

    const newStops = value.gradient.stops.map((stop, i) =>
      i === index ? { ...stop, ...updates } : stop
    );
    updateBackground({
      gradient: { ...value.gradient, stops: newStops },
    });
  };

  return (
    <div className="space-y-4">
      {label && <Label className="text-sm font-medium">{label}</Label>}

      {/* Type Selector */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Type</Label>
        <Select
          value={value.type}
          onValueChange={(v) => {
            const newType = v as BackgroundConfig['type'];
            const updates: Partial<BackgroundConfig> = { type: newType };

            if (newType === 'gradient' && !value.gradient) {
              updates.gradient = {
                type: 'linear',
                angle: 135,
                stops: [
                  { color: value.color || '#ffffff', position: 0 },
                  { color: '#e5e7eb', position: 100 },
                ],
              };
            }

            if (newType === 'pattern' && !value.pattern) {
              updates.pattern = {
                type: 'dots',
                color: '#000000',
                size: 10,
                opacity: 0.1,
              };
            }

            if (newType === 'image' && !getImageUrl(value)) {
              const defaultImage = propertyImages[0];
              if (defaultImage) {
                updates.imageUrl = defaultImage.url;
                updates.imageSize = 'cover';
                updates.imagePosition = 'center';
                updates.image = {
                  url: defaultImage.url,
                  size: 'cover',
                  position: 'center',
                  repeat: 'no-repeat',
                  opacity: 1,
                };
              }
            }

            onChange(syncImageObject(value, updates));
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BACKGROUND_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Solid Color */}
      {value.type === 'solid' && (
        <ColorPicker
          label="Color"
          value={value.color}
          onChange={(color) => updateBackground({ color })}
        />
      )}

      {/* Gradient */}
      {value.type === 'gradient' && value.gradient && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Type</Label>
              <Select
                value={value.gradient.type}
                onValueChange={(v) =>
                  updateBackground({
                    gradient: {
                      ...value.gradient!,
                      type: v as 'linear' | 'radial',
                    },
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADIENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {value.gradient.type === 'linear' && (
              <NumberSlider
                label="Angle"
                value={value.gradient.angle}
                onChange={(angle) =>
                  updateBackground({
                    gradient: { ...value.gradient!, angle },
                  })
                }
                min={0}
                max={360}
                step={5}
                unit="°"
              />
            )}
          </div>

          {/* Gradient Stops */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs">Color Stops</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addGradientStop}
                className="h-6 px-2 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>

            {value.gradient.stops.map((stop, index) => (
              <div key={index} className="flex items-center gap-2">
                <ColorPicker
                  value={stop.color}
                  onChange={(color) => updateGradientStop(index, { color })}
                />
                <NumberSlider
                  value={stop.position}
                  onChange={(position) => updateGradientStop(index, { position })}
                  min={0}
                  max={100}
                  unit="%"
                />
                {value.gradient!.stops.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGradientStop(index)}
                    className="text-destructive hover:text-destructive h-8 w-8 shrink-0 p-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pattern */}
      {value.type === 'pattern' && value.pattern && (
        <div className="space-y-4">
          <ColorPicker
            label="Base Color"
            value={value.color}
            onChange={(color) => updateBackground({ color })}
          />

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Pattern</Label>
            <Select
              value={value.pattern.type}
              onValueChange={(v) =>
                updateBackground({
                  pattern: {
                    ...value.pattern!,
                    type: v as NonNullable<BackgroundConfig['pattern']>['type'],
                  },
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PATTERN_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ColorPicker
            label="Pattern Color"
            value={value.pattern.color}
            onChange={(color) =>
              updateBackground({
                pattern: { ...value.pattern!, color },
              })
            }
          />

          <NumberSlider
            label="Size"
            value={value.pattern.size}
            onChange={(size) =>
              updateBackground({
                pattern: { ...value.pattern!, size },
              })
            }
            min={4}
            max={50}
          />

          <NumberSlider
            label="Opacity"
            value={value.pattern.opacity}
            onChange={(opacity) =>
              updateBackground({
                pattern: { ...value.pattern!, opacity },
              })
            }
            min={0}
            max={1}
            step={0.05}
            unit=""
          />
        </div>
      )}

      {/* Image */}
      {value.type === 'image' && (
        <ImageSourceSelector
          value={value}
          updateBackground={updateBackground}
          propertyImages={propertyImages}
        />
      )}

      {/* Preview */}
      <div className="flex items-center justify-center py-2">
        {value.type === 'image' && !getImageUrl(value) ? (
          <div className="border-border bg-muted/30 text-muted-foreground flex h-16 w-full items-center justify-center rounded-md border border-dashed text-xs">
            No image selected
          </div>
        ) : (
          <div
            className="border-border h-16 w-full rounded-md border"
            style={getBackgroundStyle(value)}
          />
        )}
      </div>
    </div>
  );
}

// Helper function to generate CSS background style
export function getBackgroundStyle(config: BackgroundConfig): React.CSSProperties {
  if (config.type === 'solid') {
    return { backgroundColor: config.color };
  }

  if (config.type === 'gradient' && config.gradient) {
    const { type, angle, stops } = config.gradient;
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);
    const stopsString = sortedStops.map((s) => `${s.color} ${s.position}%`).join(', ');

    if (type === 'linear') {
      return {
        background: `linear-gradient(${angle}deg, ${stopsString})`,
      };
    }
    return {
      background: `radial-gradient(circle, ${stopsString})`,
    };
  }

  if (config.type === 'pattern' && config.pattern) {
    const { type, color, size, opacity } = config.pattern;
    const patternColor = color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');

    switch (type) {
      case 'dots':
        return {
          backgroundColor: config.color,
          backgroundImage: `radial-gradient(${patternColor} 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'grid':
        return {
          backgroundColor: config.color,
          backgroundImage: `linear-gradient(${patternColor} 1px, transparent 1px), linear-gradient(to right, ${patternColor} 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'lines':
        return {
          backgroundColor: config.color,
          backgroundImage: `linear-gradient(${patternColor} 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'diagonal':
        return {
          backgroundColor: config.color,
          backgroundImage: `repeating-linear-gradient(45deg, ${patternColor}, ${patternColor} 1px, transparent 1px, transparent ${size}px)`,
        };
      default:
        return { backgroundColor: config.color };
    }
  }

  if (config.type === 'image') {
    const url = config.imageUrl || config.image?.url;
    if (!url) return {};

    const size = config.imageSize || config.image?.size || 'cover';
    const position = config.imagePosition || config.image?.position || 'center';
    const repeat = config.image?.repeat || 'no-repeat';
    const opacity = config.image?.opacity ?? config.opacity ?? 1;

    // If there's an overlay color, create a layered background
    const overlayColor = config.color || 'transparent';
    const hasOverlay = overlayColor && overlayColor !== 'transparent' && overlayColor !== '#000000';

    if (hasOverlay && opacity < 1) {
      return {
        backgroundImage: `linear-gradient(${overlayColor}${Math.round((1 - opacity) * 255)
          .toString(16)
          .padStart(2, '0')}, ${overlayColor}${Math.round((1 - opacity) * 255)
          .toString(16)
          .padStart(2, '0')}), url(${url})`,
        backgroundSize: size === 'auto' ? 'auto' : size,
        backgroundPosition: position,
        backgroundRepeat: repeat,
      };
    }

    return {
      backgroundImage: `url(${url})`,
      backgroundSize: size === 'auto' ? 'auto' : size,
      backgroundPosition: position,
      backgroundRepeat: repeat,
      opacity: opacity,
    };
  }

  return { backgroundColor: config.color };
}
