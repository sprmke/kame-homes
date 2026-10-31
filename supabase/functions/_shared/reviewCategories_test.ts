import { assertEquals } from 'jsr:@std/assert@1';

import {
  GUEST_REVIEW_CATEGORY_IDS,
  isValidStarRating,
  parseGuestCategoryRatings,
  parseHostReviewTags,
  validateGuestCategoryRatings,
  validateHostGuestReviewFields,
  validateHostReviewTags,
} from './reviewCategories.ts';

const FULL_RATINGS = {
  cleanliness: 5,
  accuracy: 4,
  check_in: 5,
  communication: 5,
  location: 4,
  value: 5,
};

Deno.test(
  'validateGuestCategoryRatings (D9): passes only when all 6 categories are present and valid',
  () => {
    assertEquals(validateGuestCategoryRatings(FULL_RATINGS), null);
    assertEquals(GUEST_REVIEW_CATEGORY_IDS.length, 6);
  }
);

Deno.test('validateGuestCategoryRatings: rejects missing category', () => {
  const partial = {
    cleanliness: 5,
    accuracy: 4,
    check_in: 5,
    communication: 5,
    location: 4,
    // value is missing
  };
  const err = validateGuestCategoryRatings(partial);
  assertEquals(typeof err, 'string');
});

Deno.test('validateGuestCategoryRatings: rejects out-of-range or non-integer values', () => {
  assertEquals(typeof validateGuestCategoryRatings({ ...FULL_RATINGS, cleanliness: 6 }), 'string');
  assertEquals(typeof validateGuestCategoryRatings({ ...FULL_RATINGS, cleanliness: 0 }), 'string');
  assertEquals(
    typeof validateGuestCategoryRatings({ ...FULL_RATINGS, cleanliness: 3.5 }),
    'string'
  );
});

Deno.test('validateGuestCategoryRatings: rejects non-object input', () => {
  assertEquals(typeof validateGuestCategoryRatings(null), 'string');
  assertEquals(typeof validateGuestCategoryRatings('nope'), 'string');
  assertEquals(typeof validateGuestCategoryRatings([]), 'string');
});

Deno.test('parseGuestCategoryRatings: drops invalid entries, keeps valid ones', () => {
  const parsed = parseGuestCategoryRatings({ cleanliness: 5, accuracy: 'bad', location: 10 });
  assertEquals(parsed.cleanliness, 5);
  assertEquals(parsed.accuracy, undefined);
  assertEquals(parsed.location, undefined);
});

Deno.test('isValidStarRating accepts only integers 1-5', () => {
  assertEquals(isValidStarRating(1), true);
  assertEquals(isValidStarRating(5), true);
  assertEquals(isValidStarRating(0), false);
  assertEquals(isValidStarRating(6), false);
  assertEquals(isValidStarRating(3.5), false);
  assertEquals(isValidStarRating('5'), false);
});

Deno.test('parseHostReviewTags parses a JSON array string and drops non-strings', () => {
  assertEquals(parseHostReviewTags(JSON.stringify(['great_communicator', 'left_it_spotless'])), [
    'great_communicator',
    'left_it_spotless',
  ]);
  assertEquals(parseHostReviewTags(null), []);
  assertEquals(parseHostReviewTags('not json'), []);
});

Deno.test('validateHostReviewTags: strength tags only allowed when overall >= 4', () => {
  assertEquals(validateHostReviewTags(5, ['great_communicator']), null);
  assertEquals(validateHostReviewTags(2, ['great_communicator']), 'Invalid tag');
  assertEquals(validateHostReviewTags(2, ['left_it_messy']), null);
  assertEquals(validateHostReviewTags(5, ['left_it_messy']), 'Invalid tag');
});

Deno.test('validateHostReviewTags: enforces MAX_HOST_REVIEW_TAGS and allows empty', () => {
  assertEquals(validateHostReviewTags(5, []), null);
  const tooMany = Array.from({ length: 7 }, () => 'great_communicator');
  assertEquals(typeof validateHostReviewTags(5, tooMany), 'string');
});

const HOST_OK = {
  overallRating: 5,
  cleanlinessRating: 5,
  communicationRating: 4,
  houseRulesRating: 5,
  wouldHostAgain: true,
  reviewText: null as string | null,
};

Deno.test('validateHostGuestReviewFields: overall + 3 categories + wouldHostAgain required', () => {
  assertEquals(validateHostGuestReviewFields(HOST_OK), null);
  assertEquals(typeof validateHostGuestReviewFields({ ...HOST_OK, overallRating: 0 }), 'string');
  assertEquals(
    typeof validateHostGuestReviewFields({ ...HOST_OK, wouldHostAgain: 'yes' }),
    'string'
  );
});

Deno.test('validateHostGuestReviewFields: text required when overall is 3 or below', () => {
  assertEquals(
    typeof validateHostGuestReviewFields({
      ...HOST_OK,
      overallRating: 3,
      reviewText: 'too short',
    }),
    'string'
  );
  assertEquals(
    validateHostGuestReviewFields({
      ...HOST_OK,
      overallRating: 3,
      reviewText: 'The guest left trash in the kitchen and ignored house rules.',
    }),
    null
  );
});
