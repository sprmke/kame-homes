/** Canvas chrome colors for OpenPolotno `<Workspace />` (inline styles override CSS). */
export type PolotnoWorkspaceChrome = {
  backgroundColor: string;
  pageBorderColor: string;
  activePageBorderColor: string;
  snapGuideStroke: string;
  distanceGuideStroke: string;
  distanceLabelFill: string;
};

export function polotnoWorkspaceChrome(isDark: boolean): PolotnoWorkspaceChrome {
  if (isDark) {
    return {
      backgroundColor: 'hsl(0 0% 7%)',
      pageBorderColor: 'hsl(0 0% 20%)',
      activePageBorderColor: 'hsl(168 65% 45%)',
      snapGuideStroke: 'hsl(168 65% 45%)',
      distanceGuideStroke: 'hsl(168 65% 45%)',
      distanceLabelFill: 'hsl(168 65% 45%)',
    };
  }

  return {
    backgroundColor: 'hsl(0 0% 100%)',
    pageBorderColor: 'hsl(220 13% 85%)',
    activePageBorderColor: 'hsl(168 65% 40%)',
    snapGuideStroke: 'hsl(168 65% 40%)',
    distanceGuideStroke: 'hsl(168 65% 40%)',
    distanceLabelFill: 'hsl(168 65% 40%)',
  };
}
