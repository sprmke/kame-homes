import { describe, expect, it } from 'vitest';

import { uid, resetIds, createCampaignLayout, textBoxHeight, campaignPageBackground, photoScrim, figure, text, centeredText, eyebrow, heroText, detailText, thinRule, thinVRule, outlinePill, dateMark, galleryFooter, logoImage, photoImage, buildPolotnoCampaignDocument, formatDimensions, FONT_DISPLAY, FONT_LABEL, FONT_BODY, FONT_NUMERAL } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';

describe('uid', () => {

  it('uid is exported', () => {
    expect(typeof uid).toBe('function');
  });

});

describe('resetIds', () => {

  it('resetIds is exported', () => {
    expect(typeof resetIds).toBe('function');
  });

});

describe('createCampaignLayout', () => {

  it('createCampaignLayout is exported', () => {
    expect(typeof createCampaignLayout).toBe('function');
  });

});

describe('textBoxHeight', () => {

  it('textBoxHeight is exported', () => {
    expect(typeof textBoxHeight).toBe('function');
  });

});

describe('campaignPageBackground', () => {

  it('campaignPageBackground is exported', () => {
    expect(typeof campaignPageBackground).toBe('function');
  });

});

describe('photoScrim', () => {

  it('photoScrim is exported', () => {
    expect(typeof photoScrim).toBe('function');
  });

});

describe('figure', () => {

  it('figure is exported', () => {
    expect(typeof figure).toBe('function');
  });

});

describe('text', () => {

  it('text is exported', () => {
    expect(typeof text).toBe('function');
  });

});

describe('centeredText', () => {

  it('centeredText is exported', () => {
    expect(typeof centeredText).toBe('function');
  });

});

describe('eyebrow', () => {

  it('eyebrow is exported', () => {
    expect(typeof eyebrow).toBe('function');
  });

});

describe('heroText', () => {

  it('heroText is exported', () => {
    expect(typeof heroText).toBe('function');
  });

});

describe('detailText', () => {

  it('detailText is exported', () => {
    expect(typeof detailText).toBe('function');
  });

});

describe('thinRule', () => {

  it('thinRule is exported', () => {
    expect(typeof thinRule).toBe('function');
  });

});

describe('thinVRule', () => {

  it('thinVRule is exported', () => {
    expect(typeof thinVRule).toBe('function');
  });

});

describe('outlinePill', () => {

  it('outlinePill is exported', () => {
    expect(typeof outlinePill).toBe('function');
  });

});

describe('dateMark', () => {

  it('dateMark is exported', () => {
    expect(typeof dateMark).toBe('function');
  });

});

describe('galleryFooter', () => {

  it('galleryFooter is exported', () => {
    expect(typeof galleryFooter).toBe('function');
  });

});

describe('logoImage', () => {

  it('logoImage is exported', () => {
    expect(typeof logoImage).toBe('function');
  });

});

describe('photoImage', () => {

  it('photoImage is exported', () => {
    expect(typeof photoImage).toBe('function');
  });

});

describe('buildPolotnoCampaignDocument', () => {

  it('buildPolotnoCampaignDocument is exported', () => {
    expect(typeof buildPolotnoCampaignDocument).toBe('function');
  });

});

describe('formatDimensions', () => {

  it('formatDimensions is exported', () => {
    expect(typeof formatDimensions).toBe('function');
  });

});

describe('FONT_DISPLAY', () => {
  it('is defined', () => {
    expect(FONT_DISPLAY).toBeDefined();
  });
});

describe('FONT_LABEL', () => {
  it('is defined', () => {
    expect(FONT_LABEL).toBeDefined();
  });
});

describe('FONT_BODY', () => {
  it('is defined', () => {
    expect(FONT_BODY).toBeDefined();
  });
});

describe('FONT_NUMERAL', () => {
  it('is defined', () => {
    expect(FONT_NUMERAL).toBeDefined();
  });
});
