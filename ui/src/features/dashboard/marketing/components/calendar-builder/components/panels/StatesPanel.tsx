import { useRef, useCallback, useState, useEffect } from 'react';

import { Palette, CalendarCheck, CalendarX, CalendarDays, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

import { StyleSection, StyleSubSection } from './StyleSection';
import { useCalendarBuilderStore } from '../../stores/calendarBuilderStore';
import { type BookedStateStyles } from '../../types';
import {
  BackgroundControl,
  BorderControl,
  FontSelector,
  ColorPicker,
  NumberSlider,
} from '../controls';

// Predefined icons for booked state
const BOOKED_ICONS = [
  { value: 'check', label: 'Check Mark', svg: '✓' },
  { value: 'x', label: 'X Mark', svg: '✕' },
  { value: 'calendar-check', label: 'Calendar Check', svg: '📅' },
  { value: 'user', label: 'User', svg: '👤' },
  { value: 'bed', label: 'Bed', svg: '🛏️' },
  { value: 'house', label: 'House', svg: '🏠' },
  { value: 'key', label: 'Key', svg: '🔑' },
  { value: 'lock', label: 'Lock', svg: '🔒' },
  { value: 'star', label: 'Star', svg: '⭐' },
  { value: 'heart', label: 'Heart', svg: '❤️' },
  { value: 'ban', label: 'Blocked', svg: '🚫' },
  { value: 'reserved', label: 'Reserved', svg: '📌' },
] as const;

export function TodayPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const today = styles.today;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`today.${path}`, value);
  };

  return (
    <StyleSection title="Today Highlight" icon={<CalendarDays className="h-4 w-4" />}>
      <div className="flex items-center gap-2 py-2">
        <Checkbox
          id="today-enabled"
          checked={today.enabled}
          onCheckedChange={(checked) => {
            handleChange('enabled', checked);
            saveToHistory();
          }}
        />
        <Label htmlFor="today-enabled" className="text-sm">
          Highlight Today
        </Label>
      </div>

      {today.enabled && (
        <>
          <StyleSubSection title="Background">
            <BackgroundControl
              value={today.background}
              onChange={(value) => {
                handleChange('background', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          <StyleSubSection title="Border">
            <BorderControl
              value={today.border}
              onChange={(value) => {
                handleChange('border', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          <StyleSubSection title="Day Number">
            <ColorPicker
              label="Text Color"
              value={today.dayNumberColor}
              onChange={(value) => {
                handleChange('dayNumberColor', value);
                saveToHistory();
              }}
            />
            <ColorPicker
              label="Background"
              value={today.dayNumberBackground}
              onChange={(value) => {
                handleChange('dayNumberBackground', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          <StyleSubSection title="Indicator">
            <div className="flex items-center gap-2">
              <Checkbox
                id="today-indicator-show"
                checked={today.indicator.show}
                onCheckedChange={(checked) => {
                  handleChange('indicator.show', checked);
                  saveToHistory();
                }}
              />
              <Label htmlFor="today-indicator-show" className="text-xs">
                Show Indicator
              </Label>
            </div>

            {today.indicator.show && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <Select
                    value={today.indicator.type}
                    onValueChange={(value) => {
                      handleChange('indicator.type', value);
                      saveToHistory();
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dot">Dot</SelectItem>
                      <SelectItem value="ring">Ring</SelectItem>
                      <SelectItem value="underline">Underline</SelectItem>
                      <SelectItem value="badge">Badge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ColorPicker
                  label="Color"
                  value={today.indicator.color}
                  onChange={(value) => {
                    handleChange('indicator.color', value);
                    saveToHistory();
                  }}
                />
                <NumberSlider
                  label="Size"
                  value={today.indicator.size}
                  onChange={(v) => {
                    handleChange('indicator.size', v);
                    saveToHistory();
                  }}
                  min={2}
                  max={20}
                />
              </div>
            )}
          </StyleSubSection>
        </>
      )}
    </StyleSection>
  );
}

// Helper to determine icon source type
function getIconSourceType(value: string | undefined, type: string): 'icon' | 'upload' | 'url' {
  if (type === 'icon') return 'icon';
  if (!value) return 'url';
  if (value.startsWith('data:')) return 'upload';
  return 'url';
}

// Icon/Image Overlay Section with upload capability
function BookedIconOverlaySection({
  booked,
  handleChange,
  saveToHistory,
}: {
  booked: BookedStateStyles;
  handleChange: (path: string, value: unknown) => void;
  saveToHistory: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track selected source type separately
  const [selectedSource, setSelectedSource] = useState<'icon' | 'upload' | 'url'>(() =>
    getIconSourceType(booked.icon.value, booked.icon.type)
  );

  // Update selected source when value changes externally
  useEffect(() => {
    const currentType = getIconSourceType(booked.icon.value, booked.icon.type);
    if (booked.icon.value) {
      setSelectedSource(currentType);
    }
  }, [booked.icon.value, booked.icon.type]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      // Validate file size (max 2MB for icons)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be less than 2MB');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        handleChange('icon.type', 'image');
        handleChange('icon.value', dataUrl);
        saveToHistory();
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
    [handleChange, saveToHistory]
  );

  const handleClearImage = useCallback(() => {
    handleChange('icon.value', '');
    saveToHistory();
  }, [handleChange, saveToHistory]);

  return (
    <StyleSubSection title="Icon/Image Overlay">
      <div className="space-y-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Source Type Selection */}
        <RadioGroup
          value={selectedSource}
          onValueChange={(v) => {
            const newSource = v as 'icon' | 'upload' | 'url';
            setSelectedSource(newSource);

            // Only initialize with default if switching to icon and no icon is selected
            if (newSource === 'icon' && booked.icon.type !== 'icon') {
              handleChange('icon.type', 'icon');
              handleChange('icon.value', 'check');
              saveToHistory();
            }
            // For upload and url, just switch the view - don't clear or modify values
          }}
          className="flex flex-wrap gap-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="icon" id="icon-preset" />
            <Label htmlFor="icon-preset" className="cursor-pointer text-xs font-normal">
              Icon
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="upload" id="icon-upload" />
            <Label htmlFor="icon-upload" className="cursor-pointer text-xs font-normal">
              Upload
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="url" id="icon-url" />
            <Label htmlFor="icon-url" className="cursor-pointer text-xs font-normal">
              URL
            </Label>
          </div>
        </RadioGroup>

        {/* Icon Selection */}
        {selectedSource === 'icon' && (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Select Icon</Label>
            <Select
              value={booked.icon.value}
              onValueChange={(value) => {
                handleChange('icon.value', value);
                saveToHistory();
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select an icon" />
              </SelectTrigger>
              <SelectContent>
                {BOOKED_ICONS.map((icon) => (
                  <SelectItem key={icon.value} value={icon.value}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon.svg}</span>
                      <span>{icon.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Icon Preview */}
            {booked.icon.value && (
              <div className="border-border bg-muted/30 mt-2 flex items-center justify-center rounded-lg border border-dashed p-4">
                <span
                  className="text-4xl"
                  style={{ color: booked.icon.color, opacity: booked.icon.opacity }}
                >
                  {BOOKED_ICONS.find((i) => i.value === booked.icon.value)?.svg}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Upload Section */}
        {selectedSource === 'upload' && (
          <div className="space-y-2">
            {booked.icon.value && booked.icon.value.startsWith('data:') ? (
              <>
                <Label className="text-muted-foreground text-xs">Uploaded Image</Label>
                <div className="border-border bg-muted/30 relative flex items-center justify-center rounded-lg border border-dashed p-4">
                  <img
                    src={booked.icon.value}
                    alt="Uploaded"
                    className="max-h-16 max-w-16 object-contain"
                    style={{ opacity: booked.icon.opacity }}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2 h-6 w-6"
                    onClick={handleClearImage}
                  >
                    <X className="h-3 w-3" />
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
              </>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-muted-foreground/25 bg-muted/50 hover:border-primary/50 hover:bg-muted flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors"
              >
                <div className="bg-primary/10 rounded-full p-2">
                  <Upload className="text-primary h-4 w-4" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium">Click to upload</p>
                  <p className="text-muted-foreground text-[10px]">PNG, JPG (max 2MB)</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* URL Input */}
        {selectedSource === 'url' && (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Image URL</Label>
            <Input
              value={booked.icon.value}
              onChange={(e) => handleChange('icon.value', e.target.value)}
              onBlur={saveToHistory}
              placeholder="https://example.com/image.png"
              className="h-9"
            />
            <p className="text-muted-foreground text-[10px]">Enter URL to PNG, JPG, or SVG image</p>

            {/* URL Image Preview */}
            {booked.icon.value && !booked.icon.value.startsWith('data:') && (
              <div className="border-border bg-muted/30 mt-2 flex items-center justify-center rounded-lg border border-dashed p-4">
                <img
                  src={booked.icon.value}
                  alt="Preview"
                  className="max-h-16 max-w-16 object-contain"
                  style={{ opacity: booked.icon.opacity }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Position */}
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Position</Label>
          <Select
            value={booked.icon.position}
            onValueChange={(value) => {
              handleChange('icon.position', value);
              saveToHistory();
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="top-left">Top Left</SelectItem>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Size */}
        <NumberSlider
          label="Size"
          value={booked.icon.size}
          onChange={(v) => {
            handleChange('icon.size', v);
            saveToHistory();
          }}
          min={12}
          max={48}
        />

        {/* Color (only for icons, not images) */}
        {selectedSource === 'icon' && (
          <ColorPicker
            label="Color"
            value={booked.icon.color}
            onChange={(value) => {
              handleChange('icon.color', value);
              saveToHistory();
            }}
          />
        )}

        {/* Opacity */}
        <NumberSlider
          label="Opacity"
          value={booked.icon.opacity}
          onChange={(v) => {
            handleChange('icon.opacity', v);
            saveToHistory();
          }}
          min={0}
          max={1}
          step={0.1}
          unit=""
        />
      </div>
    </StyleSubSection>
  );
}

export function BookedPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const booked = styles.booked;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`booked.${path}`, value);
  };

  return (
    <StyleSection title="Booked State" icon={<CalendarCheck className="h-4 w-4" />}>
      <StyleSubSection title="Background">
        <BackgroundControl
          value={booked.background}
          onChange={(value) => {
            handleChange('background', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Border">
        <BorderControl
          value={booked.border}
          onChange={(value) => {
            handleChange('border', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Day Number">
        <ColorPicker
          label="Color"
          value={booked.dayNumberColor}
          onChange={(value) => {
            handleChange('dayNumberColor', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Display Mode">
        <RadioGroup
          value={booked.icon.show ? 'icon' : 'text'}
          onValueChange={(value) => {
            if (value === 'icon') {
              handleChange('icon.show', true);
              handleChange('text.show', false);
            } else {
              handleChange('icon.show', false);
              handleChange('text.show', true);
            }
            saveToHistory();
          }}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id="display-text" />
            <Label htmlFor="display-text" className="cursor-pointer text-xs font-normal">
              Show Text
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="icon" id="display-icon" />
            <Label htmlFor="display-icon" className="cursor-pointer text-xs font-normal">
              Show Icon/Image
            </Label>
          </div>
        </RadioGroup>
      </StyleSubSection>

      {booked.text.show && !booked.icon.show && (
        <StyleSubSection title="Text Overlay">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Text</Label>
              <Input
                value={booked.text.content}
                onChange={(e) => handleChange('text.content', e.target.value)}
                onBlur={saveToHistory}
                placeholder="BOOKED"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Position</Label>
              <Select
                value={booked.text.position}
                onValueChange={(value) => {
                  handleChange('text.position', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FontSelector
              value={booked.text.font}
              onChange={(value) => {
                handleChange('text.font', value);
                saveToHistory();
              }}
            />
            <ColorPicker
              label="Color"
              value={booked.text.color}
              onChange={(value) => {
                handleChange('text.color', value);
                saveToHistory();
              }}
            />
          </div>
        </StyleSubSection>
      )}

      {booked.icon.show && (
        <BookedIconOverlaySection
          booked={booked}
          handleChange={handleChange}
          saveToHistory={saveToHistory}
        />
      )}

      <StyleSubSection title="Pattern Overlay">
        <div className="flex items-center gap-2">
          <Checkbox
            id="booked-pattern-show"
            checked={booked.pattern.show}
            onCheckedChange={(checked) => {
              handleChange('pattern.show', checked);
              saveToHistory();
            }}
          />
          <Label htmlFor="booked-pattern-show" className="text-xs">
            Show Pattern
          </Label>
        </div>

        {booked.pattern.show && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Type</Label>
              <Select
                value={booked.pattern.type}
                onValueChange={(value) => {
                  handleChange('pattern.type', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="stripes">Stripes</SelectItem>
                  <SelectItem value="dots">Dots</SelectItem>
                  <SelectItem value="cross">Cross</SelectItem>
                  <SelectItem value="diagonal">Diagonal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ColorPicker
              label="Pattern Color"
              value={booked.pattern.color}
              onChange={(value) => {
                handleChange('pattern.color', value);
                saveToHistory();
              }}
            />
            <NumberSlider
              label="Size"
              value={booked.pattern.size}
              onChange={(v) => {
                handleChange('pattern.size', v);
                saveToHistory();
              }}
              min={4}
              max={30}
            />
            <NumberSlider
              label="Opacity"
              value={booked.pattern.opacity}
              onChange={(v) => {
                handleChange('pattern.opacity', v);
                saveToHistory();
              }}
              min={0}
              max={1}
              step={0.1}
              unit=""
            />
          </div>
        )}
      </StyleSubSection>

      <StyleSubSection title="Guest Info">
        <div className="flex items-center gap-2">
          <Checkbox
            id="booked-guest-show"
            checked={booked.guestInfo.show}
            onCheckedChange={(checked) => {
              handleChange('guestInfo.show', checked);
              saveToHistory();
            }}
          />
          <Label htmlFor="booked-guest-show" className="text-xs">
            Show Guest Name
          </Label>
        </div>

        {booked.guestInfo.show && (
          <div className="mt-3 space-y-3">
            <FontSelector
              value={booked.guestInfo.font}
              onChange={(value) => {
                handleChange('guestInfo.font', value);
                saveToHistory();
              }}
            />
            <ColorPicker
              label="Color"
              value={booked.guestInfo.color}
              onChange={(value) => {
                handleChange('guestInfo.color', value);
                saveToHistory();
              }}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="guest-truncate"
                checked={booked.guestInfo.truncate}
                onCheckedChange={(checked) => {
                  handleChange('guestInfo.truncate', checked);
                  saveToHistory();
                }}
              />
              <Label htmlFor="guest-truncate" className="text-xs">
                Truncate Long Names
              </Label>
            </div>
          </div>
        )}
      </StyleSubSection>
    </StyleSection>
  );
}

export function AvailablePanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const available = styles.available;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`available.${path}`, value);
  };

  return (
    <StyleSection title="Available State" icon={<Palette className="h-4 w-4" />}>
      <StyleSubSection title="Background">
        <BackgroundControl
          value={available.background}
          onChange={(value) => {
            handleChange('background', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Border">
        <BorderControl
          value={available.border}
          onChange={(value) => {
            handleChange('border', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Day Number">
        <ColorPicker
          label="Color"
          value={available.dayNumberColor}
          onChange={(value) => {
            handleChange('dayNumberColor', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Price Display">
        <div className="flex items-center gap-2">
          <Checkbox
            id="price-show"
            checked={available.price.show}
            onCheckedChange={(checked) => {
              handleChange('price.show', checked);
              saveToHistory();
            }}
          />
          <Label htmlFor="price-show" className="text-xs">
            Show Price
          </Label>
        </div>

        {available.price.show && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Position</Label>
              <Select
                value={available.price.position}
                onValueChange={(value) => {
                  handleChange('price.position', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Format</Label>
              <Select
                value={available.price.format}
                onValueChange={(value) => {
                  handleChange('price.format', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="currency">Currency (₱2,500)</SelectItem>
                  <SelectItem value="plain">Plain (2500)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FontSelector
              value={available.price.font}
              onChange={(value) => {
                handleChange('price.font', value);
                saveToHistory();
              }}
            />
            <ColorPicker
              label="Color"
              value={available.price.color}
              onChange={(value) => {
                handleChange('price.color', value);
                saveToHistory();
              }}
            />
          </div>
        )}
      </StyleSubSection>
    </StyleSection>
  );
}

export function BlockedPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const blocked = styles.blocked;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`blocked.${path}`, value);
  };

  return (
    <StyleSection title="Blocked State" icon={<CalendarX className="h-4 w-4" />}>
      <StyleSubSection title="Background">
        <BackgroundControl
          value={blocked.background}
          onChange={(value) => {
            handleChange('background', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Border">
        <BorderControl
          value={blocked.border}
          onChange={(value) => {
            handleChange('border', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Day Number">
        <ColorPicker
          label="Color"
          value={blocked.dayNumberColor}
          onChange={(value) => {
            handleChange('dayNumberColor', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Text Overlay">
        <div className="flex items-center gap-2">
          <Checkbox
            id="blocked-text-show"
            checked={blocked.text.show}
            onCheckedChange={(checked) => {
              handleChange('text.show', checked);
              saveToHistory();
            }}
          />
          <Label htmlFor="blocked-text-show" className="text-xs">
            Show Text
          </Label>
        </div>

        {blocked.text.show && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Text</Label>
              <Input
                value={blocked.text.content}
                onChange={(e) => handleChange('text.content', e.target.value)}
                onBlur={saveToHistory}
                placeholder="N/A"
                className="h-9"
              />
            </div>
            <FontSelector
              value={blocked.text.font}
              onChange={(value) => {
                handleChange('text.font', value);
                saveToHistory();
              }}
            />
            <ColorPicker
              label="Color"
              value={blocked.text.color}
              onChange={(value) => {
                handleChange('text.color', value);
                saveToHistory();
              }}
            />
          </div>
        )}
      </StyleSubSection>

      <StyleSubSection title="Pattern Overlay">
        <div className="flex items-center gap-2">
          <Checkbox
            id="blocked-pattern-show"
            checked={blocked.pattern.show}
            onCheckedChange={(checked) => {
              handleChange('pattern.show', checked);
              saveToHistory();
            }}
          />
          <Label htmlFor="blocked-pattern-show" className="text-xs">
            Show Pattern
          </Label>
        </div>

        {blocked.pattern.show && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Type</Label>
              <Select
                value={blocked.pattern.type}
                onValueChange={(value) => {
                  handleChange('pattern.type', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="stripes">Stripes</SelectItem>
                  <SelectItem value="cross">Cross</SelectItem>
                  <SelectItem value="diagonal">Diagonal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ColorPicker
              label="Pattern Color"
              value={blocked.pattern.color}
              onChange={(value) => {
                handleChange('pattern.color', value);
                saveToHistory();
              }}
            />
            <NumberSlider
              label="Opacity"
              value={blocked.pattern.opacity}
              onChange={(v) => {
                handleChange('pattern.opacity', v);
                saveToHistory();
              }}
              min={0}
              max={1}
              step={0.1}
              unit=""
            />
          </div>
        )}
      </StyleSubSection>
    </StyleSection>
  );
}
