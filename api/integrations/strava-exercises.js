/* What a lift is on Strava. A Weight Training activity uploaded as Strava's JSON file carries every
 * set as { exercise_type, repetitions, weight, duration }, and Strava then shows the exercises, the
 * sets and the volume the way it does for Hevy or a Garmin watch. `exercise_type` has to be one of
 * Strava's identifiers (developers.strava.com/docs/uploads, "Supported Exercises"), so each exercise
 * is matched by its name and equipment: the specific identifier when there is one, else the
 * family's *_GENERIC, else one from the muscle it trains. Names are read in English (the
 * catalogue's) and in Portuguese (a person's own exercises: "Supino reto com halteres"). */

import { LIB_BY_ID } from '../coach/core/library.js';

const LIST = {
  bench: 'BENCH_PRESS_GENERIC BARBELL_BENCH_PRESS DUMBBELL_BENCH_PRESS INCLINE_DUMBBELL_BENCH_PRESS INCLINE_BARBELL_BENCH_PRESS CLOSE_GRIP_BARBELL_BENCH_PRESS WIDE_GRIP_BARBELL_BENCH_PRESS SINGLE_ARM_CABLE_CHEST_PRESS DECLINE_DUMBBELL_BENCH_PRESS NEUTRAL_GRIP_DUMBBELL_BENCH_PRESS NEUTRAL_GRIP_DUMBBELL_INCLINE_BENCH_PRESS FLOOR_BENCH_PRESS CHEST_PRESS DUMBBELL_FLOOR_PRESS BARBELL_FEET_UP_BENCH_PRESS MACHINE_DECLINE_BENCH_PRESS SMITH_MACHINE_INCLINE_BENCH_PRESS MACHINE_INCLINE_CHEST_PRESS MACHINE_CHEST_PRESS MACHINE_ISOLATERAL_CHEST_PRESS DUMBBELL_SQUEEZE_PRESS PLATE_PRESS SVEND_PRESS_PLATE_SQUEEZE SINGLE_ARM_DUMBBELL_BENCH_PRESS BARBELL_FLOOR_PRESS SINGLE_ARM_DUMBBELL_FLOOR_PRESS CLOSE_GRIP_DUMBBELL_CHEST_PRESS PAUSED_BENCH_PRESS',
  calf: 'CALF_RAISE_GENERIC STANDING_CALF_RAISE SEATED_CALF_RAISE SINGLE_LEG_STANDING_CALF_RAISE WALKING_CALF_RAISES BENT_KNEE_CALF_RAISE DOUBLE_LEG_CALF_RAISE_ON_STEP FLOATING_HEEL_DROP MACHINE_CALF_EXTENSION MACHINE_CALF_PRESS SINGLE_LEG_BARBELL_CALF_RAISE DUMBBELL_DOUBLE_LEG_CALF_RAISE_ON_STEP SINGLE_LEG_DUMBBELL_STANDING_CALF_RAISE BENT_KNEE_DUMBBELL_CALF_RAISE DUMBBELL_WALKING_CALF_RAISES SEATED_DUMBBELL_CALF_RAISE',
  cardio: 'CARDIO_GENERIC JUMP_ROPE JUMPING_JACKS CARDIO_CORE_CRAWL SKI_MOGULS BATTLE_ROPES ROWING_MACHINE SLED_PUSH HIGH_KNEES WALL_BALL SKI_ERG ASSAULT_BIKE BURPEE_BROAD_JUMP DOUBLE_UNDERS STAIRMASTER RUNNING AGILITY_LADDER',
  carry: 'CARRY_GENERIC BAR_HOLDS FARMERS_WALK OVERHEAD_CARRY FARMERS_CARRY DEAD_HANG SUITCASE_CARRY',
  chop: 'CHOP_GENERIC CROSS_CHOP_TO_KNEE HALF_KNEELING_ROTATIONAL_CHOP STANDING_ROTATIONAL_CHOP CABLE_WOODCHOP DOWN_TO_UP_CABLE_TWIST UP_TO_DOWN_CABLE_TWIST',
  core: 'CORE_GENERIC SWIMMING LOWER_LIFT RUSSIAN_TWIST BARBELL_ROLLOUT SIDE_BEND HALF_TURKISH_GET_UP MODIFIED_FRONT_LEVER GHD_BACK_EXTENSIONS OVERHEAD_WALK CAT_COW THE_HUNDRED CABLE_CORE_PRESS CABLE_SIDE_BEND KETTLEBELL_WINDMILL SWISS_BALL_JACKKNIFE BICYCLE_CRUNCH HOLLOW_ROCK LEG_EXTENSIONS REVERSE_CRUNCH HANGING_KNEE_RAISE CABLE_CRUNCH CRUNCH TURKISH_GET_UP DEADBUG STRAIGHT_LEG_RAISE FIGURE_OF_8S SWISSBALL_STIR_POT CRUNCH_AND_PRESS DIAGONAL_TOE_TAP TRAVELLING_PRESS_UP_WALK_OUT TOE_SCRUNCHES BIRD_DOG HIP_DROP BANDED_DEADBUG STANDING_MARCH BICYCLE_CRUNCH_RAISED_LEGS DECLINE_CRUNCH WEIGHTED_DECLINE_CRUNCH DRAGON_FLAG ELBOW_TO_KNEE HEEL_TAPS LYING_KNEE_RAISE OBLIQUE_CRUNCH FRONT_LEVER_HOLD FRONT_LEVER_RAISE PALLOF_PRESS AB_WHEEL_ROLLOUT AB_CRUNCH_MACHINE MEDICINE_BALL_CRUNCH LEG_LIFTS FLUTTER_KICKS GHD_SIT_UP TOES_TO_BAR WEIGHTED_TOE_TAPS DUMBBELL_RUSSIAN_TWIST MODIFIED_PRESS_UP_POSITION_SHOULDER_TAP DUMBBELL_SIDE_BEND SIDE_PLANK_HIP_FLEXION BANDED_SIDE_PLANK_HIP_FLEXION BANDED_SIDE_PLANK_LEG_RAISE REVERSE_PLANK PLANK_SHOULDER_TAP BANDED_BICYCLE',
  curl: 'CURL_GENERIC DUMBBELL_HAMMER_CURL BARBELL_BICEPS_CURL CABLE_BICEPS_CURL BARBELL_REVERSE_WRIST_CURL BARBELL_WRIST_CURL CABLE_HAMMER_CURL INCLINE_DUMBBELL_BICEPS_CURL STANDING_DUMBBELL_BICEPS_CURL EZ_BAR_PREACHER_CURL STANDING_EZ_BAR_BICEPS_CURL KETTLEBELL_BICEPS_CURL DUMBBELL_REVERSE_WRIST_CURL BANDED_HAMSTRING_CURL DUMBBELL_WRIST_CURL TWENTY_ONES_BICEP_CURL MACHINE_BICEP_CURL SUSPENSION_BICEP_CURL CONCENTRATION_CURL CROSS_BODY_HAMMER_CURL DRAG_CURL CABLE_OVERHEAD_CURL DUMBBELL_PINWHEEL_CURL PLATE_CURL BARBELL_REVERSE_CURL ROPE_CABLE_CURL DUMBBELL_ZOTTMAN_CURL BARBELL_BEHIND_THE_BACK_BICEP_WRIST_CURL SEATED_PALMS_UP_WRIST_CURL BARBELL_SEATED_WRIST_EXTENSION WRIST_ROLLER PREACHER_CURL_MACHINE SPIDER_CURL CABLE_CURL REVERSE_CABLE_CURLS BAYESIAN_CURL',
  deadlift: 'DEADLIFT_GENERIC BARBELL_DEADLIFT DUMBBELL_DEADLIFT BARBELL_STRAIGHT_LEG_DEADLIFT SUMO_DEADLIFT RACK_PULL TRAP_BAR_DEADLIFT SINGLE_LEG_STRAIGHT_LEG_DEADLIFT STRAIGHT_LEG_DEADLIFT KB_STRAIGHT_LEG_DEADLIFT SL_DB_RDL_KNEE_DRIVE CONVENTIONAL_DEADLIFTS DUMBBELL_ROMANIAN_DEADLIFTS ROMANIAN_DEADLIFTS SINGLE_LEG_ROMANIAN_DEADLIFTS STAGGERED_RDLS CABLE_RDL BARBELL_ROMANIAN_DEADLIFT SNATCH_GRIP_DEADLIFT KETTLEBELL_DEADLIFT SL_RDL_KNEE_DRIVE SINGLE_LEG_DUMBBELL_ROMANIAN_DEADLIFTS BARBELL_STAGGERED_RDLS SINGLE_LEG_DOUBLE_DUMBBELL_ROMANIAN_DEADLIFTS SINGLE_LEG_BARBELL_ROMANIAN_DEADLIFTS SINGLE_LEG_BODYWEIGHT_ROMANIAN_DEADLIFTS',
  flye: 'FLYE_GENERIC DUMBBELL_FLYE CABLE_CROSSOVER INCLINE_DUMBBELL_FLYE KETTLEBELL_FLYE DUMBBELL_CHEST_FLY BAND_CHEST_FLY SUSPENSION_CHEST_FLY PEC_DECK_BUTTERFLY LOW_CABLE_FLY_CROSSOVERS INCLINE_REVERSE_FLY INCLINE_CABLE_FLY DUMBBELL_REAR_DELT_FLY MACHINE_CHEST_FLY',
  hipRaise: 'HIP_RAISE_GENERIC BARBELL_HIP_THRUST_ON_FLOOR CLAMS SINGLE_LEG_HIP_RAISE BARBELL_HIP_THRUST_WITH_BENCH HIP_RAISE ABDUCTOR_SIDE_LEG_RAISE STEP_DOWN RAISED_LEG_HIP_THRUST SINGLE_LEG_GLUTE_BRIDGE STAGGERED_HIP_THRUST BARBELL_HIP_THRUST GLUTE_BRIDGE LATERAL_WALK THRUSTER HIP_THRUST SL_ISO_HAMSTRING_HOLD GLUTE_BRIDGE_HAM_WALKOUT BARBELL_PARTIAL_GLUTE_BRIDGE DUMBBELL_SINGLE_LEG_HIP_THRUST MACHINE_GLUTE_KICKBACK GLUTE_KICKBACK_ON_FLOOR DUMBBELL_HIP_THRUST PLATE_HIP_THRUST BARBELL_SINGLE_LEG_HIP_THRUST SINGLE_LEG_GLUTE_BRIDGE_ABDUCTION',
  hipStability: 'HIP_STABILITY_GENERIC FIRE_HYDRANT_KICKS PRONE_HIP_INTERNAL_ROTATION QUADRUPED SIDE_LYING_LEG_RAISE STANDING_ADDUCTION STANDING_HIP_ABDUCTION LATERAL_WALKS_WITH_BAND_AT_ANKLES FIRE_HYDRANTS MACHINE_HIP_ABDUCTION MACHINE_HIP_ADDUCTION DONKEY_KICKS CABLE_KICKBACK CABLE_HIP_ABDUCTION HIP_AIRPLANE',
  hipSwing: 'KETTLEBELL_SWING HIP_SWING_GENERIC STEP_OUT_SWING SINGLE_ARM_DUMBBELL_SWING SINGLE_ARM_KETTLEBELL_SWING',
  hyper: 'HYPEREXTENSION_GENERIC BACK_EXTENSION_WITH_OPPOSITE_ARM_AND_LEG_REACH BACK_EXTENSION SUPERMAN_FROM_FLOOR MACHINE_BACK_EXTENSION REVERSE_HYPER',
  lateral: 'LATERAL_RAISE_GENERIC FRONT_RAISE BAR_MUSCLE_UP MUSCLE_UP WALL_SLIDE FORTY_FIVE_DEGREE_CABLE_EXTERNAL_ROTATION RING_DIP RING_MUSCLE_UP ROPE_CLIMB BAND_PULLAPARTS OVERHEAD_PLATE_RAISE PLATE_FRONT_RAISE CABLE_REAR_DELT_REVERSE_FLY MACHINE_REAR_DELT_REVERSE_FLY KETTLEBELL_AROUND_THE_WORLD KETTLEBELL_HALO HANDSTAND_HOLD CABLE_LATERAL_RAISE CABLE_REAR_DELT_FLY SEATED_DUMBBELL_LATERAL_RAISE',
  legCurl: 'LEG_CURL_GENERIC GOOD_MORNING SLIDING_LEG_CURL NORDIC_CURL GLUTE_HAM_RAISE MACHINE_LEG_CURL_SEATED CABLE_GOOD_MORNING STANDING_LEG_CURL MACHINE_SINGLE_LEG_CURL_SEATED BARBELL_GOOD_MORNING',
  legRaise: 'LEG_RAISE_GENERIC HANGING_LEG_RAISE LYING_STRAIGHT_LEG_RAISE KNEE_DRIVE STEP_UPS LEG_RAISE_PARALLEL_BARS',
  lunge: 'LUNGE_GENERIC WALKING_LUNGE BARBELL_REVERSE_LUNGE BARBELL_BULGARIAN_SPLIT_SQUAT BARBELL_LUNGE SIDE_LUNGE OVERHEAD_LUNGE REVERSE_LUNGE STATIC_LUNGE BARBELL_OVERHEAD_LUNGE REAR_LEG_RAISED_LUNGE FRONT_LEG_RAISED_LUNGE BANDED_SIDE_LUNGE LUNGE_HOLD_CALF_RAISE LUNGE_AND_PRESS DUMBBELL_WALKING_LUNGES LATERAL_LUNGE SMITH_MACHINE_LUNGE BARBELL_SPLIT_SQUAT SKATER_LUNGE SANDBAG_LUNGE OVERHEAD_PLATE_LUNGE SINGLE_ARM_DUMBBELL_OVERHEAD_LUNGE WALKING_LUNGE_TWIST DUMBBELL_REVERSE_LUNGE CURTSY_LUNGE DUMBBELL_SPLIT_SQUAT KETTLEBELL_LUNGE',
  olympic: 'OLYMPIC_LIFT_GENERIC CLEAN BARBELL_HANG_POWER_CLEAN BARBELL_HANG_SQUAT_CLEAN BARBELL_POWER_CLEAN BARBELL_POWER_SNATCH BARBELL_SQUAT_CLEAN BARBELL_HANG_POWER_SNATCH BARBELL_HANG_PULL BARBELL_HIGH_PULL BARBELL_SNATCH BARBELL_SPLIT_JERK CLEAN_AND_JERK PUSH_JERK SINGLE_ARM_HANG_SNATCH SPLIT_JERK SQUAT_CLEAN_AND_JERK DUMBBELL_CLEAN DUMBBELL_HANG_PULL ONE_HAND_DUMBBELL_SPLIT_SNATCH SINGLE_ARM_DUMBBELL_SNATCH SINGLE_ARM_KETTLEBELL_SNATCH SINGLE_ARM_CLEAN_AND_PRESS SINGLE_ARM_SNATCH DOUBLE_ARM_CLEAN_AND_PRESS DOUBLE_ARM_SNATCH KETTLEBELL_CLEAN BARBELL_HANG_SQUAT_SNATCH BEHIND_THE_NECK_JERK SNATCH_BALANCE MUSCLE_SNATCH MUSCLE_CLEAN CLUSTER DUMBBELL_THRUSTERS DOUBLE_ARM_CLEAN_AND_PRESS_BARBELL DUMBBELL_DOUBLE_ARM_SNATCH DEVIL_PRESS',
  plank: 'PLANK_GENERIC MOUNTAIN_CLIMBER PLANK_WITH_ARM_RAISE CROSS_BODY_MOUNTAIN_CLIMBER BEAR_CRAWL SIDE_PLANK SIDEPLANK_HIP_FLEXORS SIDE_PLANK_LEG_RAISE SL_COPENHAGEN_PLANK LL_COPENHAGEN_PLANK PLANK_TWIST PLANK_PULL_THROUGH PLANK_ON_SWISSBALL SWISSBALL_HIGH_PLANK PLANK_HOLD SIDE_PLANK_HOLD',
  plyo: 'PLYO_GENERIC BODY_WEIGHT_JUMP_SQUAT ALTERNATING_JUMP_LUNGE CROSS_KNEE_STRIKE DEPTH_JUMP LATERAL_LEAP_AND_HOP MEDICINE_BALL_OVERHEAD_THROWS MEDICINE_BALL_SLAM BOX_JUMP FULL_STAR_JUMPS POGO_JUMPS HURDLE_HOPS SL_BOX_JUMP DL_SKIPPING BOX_JUMP_DOWN_TUCK_JUMP SEATED_START_BOX_JUMP BALL_SLAMS LATERAL_BOX_JUMP BOX_JUMP_DOWN BROAD_JUMP BOX_JUMP_OVER LATERAL_MEDICINE_BALL_SLAM',
  pullUp: 'PULL_UP_GENERIC LAT_PULLDOWN CLOSE_GRIP_CHIN_UP STRAIGHT_ARM_PULLDOWN ASSISTED_CHIN_UP WEIGHTED_CHIN_UP NEGATIVE_PULL_UP RING_PULL_UP GIRONDA_STERNUM_PULL_UP WIDE_PULL_UP CABLE_LAT_PULLDOWN_CLOSE_GRIP SINGLE_ARM_LAT_PULLDOWN UNDERHAND_LAT_PULLDOWN NEUTRAL_GRIP_LAT_PULLDOWN NEUTRAL_GRIP_PULL_UP CHEST_TO_BAR_PULL_UP MACHINE_ASSISTED_PULL_UP ARCHER_PULL_UP',
  pushUp: 'PUSH_UP_GENERIC DECLINE_PUSH_UP DIAMOND_PUSH_UP HANDSTAND_PUSH_UP INCLINE_PUSH_UP ONE_ARM_PUSH_UP MILITARY_PRESS_UP MODIFIED_PUSH_UP PLANK_TO_PUSH_UP CLAP_PUSH_UPS MODIFIED_SHOULDER_FOCUSED_PRESS_UP MODIFIED_MILITARY_PRESS_UP PIKE_PUSH_UP ARCHER_PUSH_UP WALL_PUSH_UP',
  row: 'ROW_GENERIC SEATED_CABLE_ROW DUMBBELL_ROW FACE_PULL RENEGADE_ROW REVERSE_GRIP_BARBELL_ROW T_BAR_ROW KETTLEBELL_ROW ROLL_DOWN BENT_OVER_ROW SWISSBALL_BACK_EXTENSION SUPERMAN BENT_OVER_BARBELL_ROW BENT_OVER_DUMBBELL_ROW MACHINE_ISOLATERAL_HIGH_ROW LANDMINE_ROW SUSPENSION_LOW_ROW MACHINE_SEATED_ROW DUMBBELL_PULLOVER MACHINE_PULLOVER MACHINE_CHEST_SUPPORTED_ROW SEAL_ROW MEADOWS_ROW SMITH_MACHINE_ROW CHEST_SUPPORTED_ROW SLED_PULL RING_ROW MACHINE_SINGLE_ARM_SEATED_ROW INVERTED_ROW GORILLA_ROW',
  shoulderPress: 'SHOULDER_PRESS_GENERIC OVERHEAD_BARBELL_PRESS BARBELL_PUSH_PRESS ARNOLD_PRESS OVERHEAD_DUMBBELL_PRESS STANDING_SINGLE_ARM_SHOULDER_PRESS FLOOR_SEATED_SINGLE_ARM_SHOULDER_PRESS STANDING_DOUBLE_ARM_SHOULDER_PRESS FLOOR_SEATED_DOUBLE_ARM_SHOULDER_PRESS PUSH_PRESS STANDING_BARBELL_PRESS SEATED_BARBELL_PRESS BARBELL_BEHIND_THE_HEAD_SHOULDER_PRESS PRESS_UP_POSITION_SHOULDER_TAP SHOULDER_FOCUSED_PRESS_UP DUMBBELL_PUSH_PRESS SMITH_MACHINE_OVERHEAD_PRESS MACHINE_SEATED_SHOULDER_PRESS LANDMINE_SQUAT_AND_PRESS SEATED_DUMBBELL_SHOULDER_PRESS Z_PRESS MACHINE_SINGLE_ARM_SEATED_SHOULDER_PRESS',
  shoulderStability: 'SHOULDER_STABILITY_GENERIC FLOOR_I_RAISE FLOOR_T_RAISE FLOOR_Y_RAISE INCLINE_L_RAISE INCLINE_W_RAISE CABLE_PULL_APART WALL_WALK',
  shrug: 'SHRUG_GENERIC BARBELL_SHRUG BARBELL_UPRIGHT_ROW SCAPULAR_RETRACTION SERRATUS_SHRUG JUMP_SHRUG CABLE_UPRIGHT_ROW DUMBBELL_SHRUG KETTLEBELL_UPRIGHT_ROW',
  sitUp: 'SIT_UP_GENERIC V_UP THE_TEASER PRESS_UP_POSITION_DIAGONAL_TOE_TAP PRESS_UP_POSITION_WITH_SINGLE_ARM_EXTENSION PRESS_UP_POSITION_WALK_OUT',
  squat: 'SQUAT_GENERIC BARBELL_BACK_SQUAT GOBLET_SQUAT LEG_PRESS BARBELL_FRONT_SQUAT BARBELL_SQUAT_SNATCH BARBELL_STEP_UP OVERHEAD_SQUAT STEP_UP PISTOL_SQUAT SUMO_SQUAT THRUSTERS ZERCHER_SQUAT KETTLEBELL_SQUAT BARBELL_SQUAT LOPSIDED_SQUAT KB_FRONT_RACKED_SQUAT STEP_UP_AND_KNEE_DRIVE QUAD SQUAT_TO_CALF_RAISE DUMBBELL_BULGARIAN_SPLIT_SQUATS DUMBBELL_GOBLET_SQUATS GOBLET_SQUATS WALL_SIT BARBELL_BOX_SQUAT ASSISTED_PISTOL_SQUATS MACHINE_LEG_PRESS MACHINE_HACK_SQUAT MACHINE_SINGLE_LEG_PRESS BELT_SQUAT SMITH_MACHINE_SQUAT MACHINE_LEG_EXTENSION AIR_SQUAT COSSACK_SQUAT HEEL_ELEVATED_SQUAT DUMBBELL_SQUAT PENDULUM_SQUAT SISSY_SQUAT DUCK_WALK SPANISH_SQUAT',
  totalBody: 'TOTAL_BODY_GENERIC BURPEE SQUAT_THRUSTS STANDING_T_ROTATION_BALANCE BURPEE_OVER_THE_BAR TIRE_FLIP',
  triceps: 'TRICEPS_EXTENSION_GENERIC TRICEPS_PRESSDOWN SKULL_CRUSHER BENCH_DIP DUMBBELL_KICKBACK BODY_WEIGHT_DIP OVERHEAD_DUMBBELL_TRICEPS_EXTENSION SEATED_BARBELL_OVERHEAD_TRICEPS_EXTENSION TRICEP_DIP CABLE_OVERHEAD_TRICEPS_EXTENSION FLOOR_TRICEPS_DIP CHEST_DIP ASSISTED_CHEST_DIP WEIGHTED_CHEST_DIP SEATED_DIP_MACHINE SEATED_TRICEPS_PRESS DUMBBELL_SINGLE_ARM_TRICEP_EXTENSION CABLE_SINGLE_ARM_TRICEPS_PUSHDOWN DUMBBELL_SKULLCRUSHER DUMBBELL_WIDEELBOW_TRICEPS_PRESS MACHINE_TRICEP_EXTENSION CABLE_TRICEPS_PUSHDOWN STRAIGHT_LEG_BENCH_DIP CHAIR_DIPS JM_PRESS',
  warmUp: 'WARM_UP_GENERIC OPPOSITE_ARM_AND_LEG_BALANCE WALKOUT QUADRUPED_ROCKING NECK_TILTS ANKLE_CIRCLES ARM_CIRCLES FORWARD_AND_BACKWARD_LEG_SWINGS LATERAL_DUCK_UNDER REACH_ROLL_AND_LIFT SLEEPER_STRETCH THORACIC_ROTATION WALKING_HIGH_KICKS WALKING_HIGH_KNEES WALKING_KNEE_HUGS INVERTED_HAMSTRING_STRETCH STRETCH HAMSTRING_WALKOUT HEEL_WALKS TOE_WALKS SIDE_LEG_SWINGS STANDING_QUAD_STRETCH PIGEON_POSE STANDING_HAMSTRING_STRETCH LYING_HAMSTRING_STRETCH KNEELING_HIP_FLEXOR_STRETCH COBRA THREAD_THE_NEEDLE_STRETCH SIDE_LYING_QUAD_STRETCH PRONE_QUAD_STRETCH TOES_AGAINST_WALL_CALF_STRETCH SOLEUS_STRETCH WALL_CHEST_STRETCH HIGH_ARM_WALL_CHEST_STRETCH LAT_STRETCH CROSS_BODY_SHOULDER_STRETCH OVERHEAD_TRICEP_STRETCH KNEELING_HIP_FLEXOR_STRETCH_TWIST STANDING_HIP_CIRCLES STANDING_LEG_CIRCLES LEGS_WIDE_DIAGONAL_TOE_TAPS HAMSTRING_SCOOPS SHOULDER_ROTATIONS STANDING_PIGEON_POSE LYING_SPINAL_TWIST LYING_PIRIFORMIS_STRETCH CALF_BIASED_HAMSTRING_SCOOP WALL_BICEP_STRETCH LYING_HIP_ROCKS CROSS_BODY_ARM_SWING DIAGONAL_CROSS_BODY_ARM_SWING BANDED_TOE_RAISE NINETY_NINETY_HIP_ROLLS DIAGONAL_LEG_SWINGS RESISTANCE_BAND_GENERIC QUADRUPED_REACH_THROUGHS PENDULUM_LEG_SWING WORLDS_GREATEST_STRETCH BANDED_CLAMS BOSU_BALL_GENERIC HEEL_DROP_CALF_STRETCH CHILDS_POSE_LAT_STRETCH SEATED_HAMSTRING_STRETCH',
  hipThrust: 'MACHINE_SINGLE_LEG_HIP_THRUST RAISED_LEG_BARBELL_HIP_THRUST DUMBBELL_STAGGERED_HIP_THRUST FROG_PUMP MACHINE_HIP_THRUST',
  lowerLeg: 'TIBIALIS_RAISE',
  quadExtension: 'MACHINE_SINGLE_LEG_QUAD_EXTENSION BANDED_QUAD_EXTENSION',
};
/** Every exercise_type Strava takes. */
export const STRAVA_EXERCISES = new Set(Object.values(LIST).flatMap(s => s.split(' ')));

/* ---------- the rules: the first that matches wins ---------- */

// The equipment a name or the catalogue's `eq` says, as flags the rules read.
function gear(n, eq) {
  const has = (re, ...eqs) => re.test(n) || eqs.includes(eq);
  return {
    smith: has(/\bsmith\b/, 'smith machine'),
    barbell: has(/\bbarbell\b|\bolympic bar\b|\bbarra\b(?! fixa)|\bbb\b/, 'barbell', 'olympic barbell', 'ez barbell'),
    ez: has(/\bez\b|\bw bar\b|barra w\b/, 'ez barbell'),
    dumbbell: has(/\bdumbbells?\b|\bhalter(es)?\b|\bdb\b/, 'dumbbell'),
    cable: has(/\bcable\b|\bpolia\b|\bcabo\b|\bcross ?over\b/, 'cable'),
    machine: has(/\bmachine\b|\blever\b|\bmaquina\b|\baparelho\b|\bcadeira\b|\bhammer strength\b/, 'leverage machine', 'sled machine', 'assisted'),
    kettlebell: has(/\bkettlebells?\b|\bkb\b/, 'kettlebell'),
    band: has(/\bband(ed)?\b|\belastico\b/, 'band', 'resistance band'),
    plate: has(/\bplate\b|\banilha\b/, 'weight plate'),
    suspension: has(/\bsuspension\b|\btrx\b/, 'suspension trainer'),
    trap: has(/\btrap ?bar\b|\bhex ?bar\b/, 'trap bar'),
  };
}

const R = [];
const rule = (re, pick) => R.push([re, pick]);
const one = /\b(single|one) (arm|leg)\b|\bunilateral\b|\bsl\b/;

// Stretching, mobility and warm-ups first: "lat stretch" is not a pulldown.
rule(/\bleg swings?\b/, () => 'FORWARD_AND_BACKWARD_LEG_SWINGS');
rule(/\barm swings?\b/, () => 'CROSS_BODY_ARM_SWING');
rule(/\barm circles?\b/, () => 'ARM_CIRCLES');
rule(/\bstretch|\balongamento\b/, () => 'STRETCH');
rule(/\byoga\b|\bpose\b|\bmobility\b|\bmobilidade\b|\bfoam\b|\bmassage\b|\bwarm ?up\b|\baquecimento\b/, () => 'WARM_UP_GENERIC');
// Cardio done inside a strength session.
rule(/\bjump(ing)? rope\b|\bpular corda\b|\bskipping rope\b/, () => 'JUMP_ROPE');
rule(/\bdouble unders?\b/, () => 'DOUBLE_UNDERS');
rule(/\bjumping jacks?\b|\bpolichinelos?\b/, () => 'JUMPING_JACKS');
rule(/\bbattle ropes?\b|\bcorda naval\b/, () => 'BATTLE_ROPES');
rule(/\bski ?erg\b/, () => 'SKI_ERG');
rule(/\bassault bike\b|\bfan bike\b/, () => 'ASSAULT_BIKE');
rule(/\bstair ?master\b|\bstep ?mill\b|\bstair climb|\bescada\b/, () => 'STAIRMASTER');
rule(/\browing machine\b|\brower\b|\bremo ergometro\b|\bremoergometro\b/, () => 'ROWING_MACHINE');
rule(/\btreadmill\b|\brun(ning)?\b|\bcorrida\b|\besteira\b/, () => 'RUNNING');
rule(/\bsled push\b|\bprowler\b/, () => 'SLED_PUSH');
rule(/\bsled (pull|drag)\b/, () => 'SLED_PULL');
rule(/\bwall ?balls?\b/, () => 'WALL_BALL');
rule(/\bhigh knees?\b/, () => 'HIGH_KNEES');
rule(/\bburpee/, () => 'BURPEE');
rule(/\bmountain climbers?\b|\bescalador\b/, () => 'MOUNTAIN_CLIMBER');
rule(/\bbear crawl\b/, () => 'BEAR_CRAWL');
rule(/\bbicycle crunch\b|^air bike\b/, () => 'BICYCLE_CRUNCH');
rule(/\btire flip\b/, () => 'TIRE_FLIP');
rule(/\bturkish get ?up\b/, () => 'TURKISH_GET_UP');
// Olympic lifts, swings, carries.
rule(/\bsnatch grip deadlift\b/, () => 'SNATCH_GRIP_DEADLIFT');
rule(/\bclean (and|&) jerk\b/, () => 'CLEAN_AND_JERK');
rule(/\bhang power clean\b/, () => 'BARBELL_HANG_POWER_CLEAN');
rule(/\bhang squat clean\b/, () => 'BARBELL_HANG_SQUAT_CLEAN');
rule(/\bpower clean\b/, () => 'BARBELL_POWER_CLEAN');
rule(/\bsquat clean\b/, () => 'BARBELL_SQUAT_CLEAN');
rule(/\bhang power snatch\b/, () => 'BARBELL_HANG_POWER_SNATCH');
rule(/\bpower snatch\b/, () => 'BARBELL_POWER_SNATCH');
rule(/\bsnatch\b/, g => (g.dumbbell ? 'SINGLE_ARM_DUMBBELL_SNATCH' : g.kettlebell ? 'SINGLE_ARM_KETTLEBELL_SNATCH' : g.barbell ? 'BARBELL_SNATCH' : 'OLYMPIC_LIFT_GENERIC'));
rule(/\bpush jerk\b/, () => 'PUSH_JERK');
rule(/\bsplit jerk\b/, () => 'SPLIT_JERK');
rule(/\bjerk\b/, () => 'OLYMPIC_LIFT_GENERIC');
rule(/\bhigh pull\b/, () => 'BARBELL_HIGH_PULL');
rule(/\bclean and press\b/, g => (one.test(g.n) ? 'SINGLE_ARM_CLEAN_AND_PRESS' : 'DOUBLE_ARM_CLEAN_AND_PRESS'));
rule(/\bclean\b/, g => (g.kettlebell ? 'KETTLEBELL_CLEAN' : g.dumbbell ? 'DUMBBELL_CLEAN' : 'CLEAN'));
rule(/\bthrusters?\b/, g => (g.dumbbell ? 'DUMBBELL_THRUSTERS' : 'THRUSTERS'));
rule(/\bdevil press\b/, () => 'DEVIL_PRESS');
rule(/\bswings?\b/, g => (g.kettlebell ? (one.test(g.n) ? 'SINGLE_ARM_KETTLEBELL_SWING' : 'KETTLEBELL_SWING') : g.dumbbell ? 'SINGLE_ARM_DUMBBELL_SWING' : 'HIP_SWING_GENERIC'));
rule(/\bfarmers?'?s? (walk|carry)\b|\bcaminhada do fazendeiro\b/, () => 'FARMERS_WALK');
rule(/\bsuitcase carry\b/, () => 'SUITCASE_CARRY');
rule(/\boverhead carry\b/, () => 'OVERHEAD_CARRY');
rule(/\bdead hang\b/, () => 'DEAD_HANG');
rule(/\brope climb/, () => 'ROPE_CLIMB');
rule(/\bfront lever\b/, () => 'FRONT_LEVER_HOLD');
rule(/\binchworm\b|\bwalk ?out\b/, () => 'WALKOUT');
rule(/\bcarry\b/, () => 'CARRY_GENERIC');
// Hinges.
rule(/\bgood ?mornings?\b|\bbom dia\b/, g => (g.barbell ? 'BARBELL_GOOD_MORNING' : g.cable ? 'CABLE_GOOD_MORNING' : 'GOOD_MORNING'));
rule(/\bromanian\b|\brdl\b/, g => (one.test(g.n)
  ? (g.dumbbell ? 'SINGLE_LEG_DUMBBELL_ROMANIAN_DEADLIFTS' : g.barbell ? 'SINGLE_LEG_BARBELL_ROMANIAN_DEADLIFTS' : 'SINGLE_LEG_ROMANIAN_DEADLIFTS')
  : g.dumbbell ? 'DUMBBELL_ROMANIAN_DEADLIFTS' : g.cable ? 'CABLE_RDL' : g.barbell ? 'BARBELL_ROMANIAN_DEADLIFT' : 'ROMANIAN_DEADLIFTS'));
rule(/\bstiff\b|\bstraight ?leg(ged)? deadlift\b/, g => (one.test(g.n) ? 'SINGLE_LEG_STRAIGHT_LEG_DEADLIFT' : g.barbell ? 'BARBELL_STRAIGHT_LEG_DEADLIFT' : g.kettlebell ? 'KB_STRAIGHT_LEG_DEADLIFT' : 'STRAIGHT_LEG_DEADLIFT'));
rule(/\bsumo (deadlift|dead lift)\b|\bterra sumo\b/, () => 'SUMO_DEADLIFT');
rule(/\brack pull\b/, () => 'RACK_PULL');
rule(/\bdead ?lift\b|\blevantamento terra\b|\bterra\b/, g => (g.trap ? 'TRAP_BAR_DEADLIFT' : g.dumbbell ? 'DUMBBELL_DEADLIFT' : g.kettlebell ? 'KETTLEBELL_DEADLIFT' : g.barbell ? 'BARBELL_DEADLIFT' : 'DEADLIFT_GENERIC'));
rule(/\bhip thrust|\belevacao pelvica\b/, g => (one.test(g.n)
  ? (g.barbell ? 'BARBELL_SINGLE_LEG_HIP_THRUST' : g.dumbbell ? 'DUMBBELL_SINGLE_LEG_HIP_THRUST' : g.machine ? 'MACHINE_SINGLE_LEG_HIP_THRUST' : 'SINGLE_LEG_HIP_RAISE')
  : g.barbell ? 'BARBELL_HIP_THRUST' : g.dumbbell ? 'DUMBBELL_HIP_THRUST' : g.machine || g.smith ? 'MACHINE_HIP_THRUST' : g.plate ? 'PLATE_HIP_THRUST' : 'HIP_THRUST'));
rule(/\bhip raise\b/, g => (one.test(g.n) ? 'SINGLE_LEG_HIP_RAISE' : 'HIP_RAISE'));
rule(/\bglute bridge\b|\bponte\b|\bhip bridge\b/, g => (one.test(g.n) ? 'SINGLE_LEG_GLUTE_BRIDGE' : g.barbell ? 'BARBELL_PARTIAL_GLUTE_BRIDGE' : 'GLUTE_BRIDGE'));
rule(/\bfrog pump/, () => 'FROG_PUMP');
rule(/\bglute kick ?back\b|\bkick ?back\b.*\bglute|\bcoice\b(?!.*\btriceps)/, g => (g.machine ? 'MACHINE_GLUTE_KICKBACK' : g.cable ? 'CABLE_KICKBACK' : 'GLUTE_KICKBACK_ON_FLOOR'));
rule(/\bdonkey kicks?\b/, () => 'DONKEY_KICKS');
rule(/\bfire hydrants?\b/, () => 'FIRE_HYDRANTS');
rule(/\bclams?(hell)?\b/, g => (g.band ? 'BANDED_CLAMS' : 'CLAMS'));
rule(/\bhip abduction\b|\babducao\b|\babdutora?\b|\babductor\b/, g => (g.machine ? 'MACHINE_HIP_ABDUCTION' : g.cable ? 'CABLE_HIP_ABDUCTION' : 'STANDING_HIP_ABDUCTION'));
rule(/\bhip adduction\b|\baducao\b|\badutora?\b|\badductor\b/, g => (g.machine ? 'MACHINE_HIP_ADDUCTION' : 'STANDING_ADDUCTION'));
rule(/\b(lateral|monster) (band )?walk/, () => 'LATERAL_WALK');
rule(/\breverse hyper/, () => 'REVERSE_HYPER');
rule(/\bback extension\b|\bhyper ?extension\b|\bhiperextensao\b|\bextensao lombar\b/, g => (g.machine ? 'MACHINE_BACK_EXTENSION' : 'BACK_EXTENSION'));
rule(/\bsuperman\b/, () => 'SUPERMAN');
// Legs.
rule(/\bbulgarian\b|\bbulgaro\b/, g => (g.barbell ? 'BARBELL_BULGARIAN_SPLIT_SQUAT' : g.dumbbell ? 'DUMBBELL_BULGARIAN_SPLIT_SQUATS' : 'LUNGE_GENERIC'));
rule(/\bsplit squat\b/, g => (g.barbell ? 'BARBELL_SPLIT_SQUAT' : g.dumbbell ? 'DUMBBELL_SPLIT_SQUAT' : 'LUNGE_GENERIC'));
rule(/\blunges?\b|\bafundo\b|\bavanco\b|\bpassada\b/, g => {
  const n = g.n;
  if (/\bwalking\b|\bpassada\b/.test(n)) return g.dumbbell ? 'DUMBBELL_WALKING_LUNGES' : 'WALKING_LUNGE';
  if (/\breverse\b|\brear\b/.test(n)) return g.barbell ? 'BARBELL_REVERSE_LUNGE' : g.dumbbell ? 'DUMBBELL_REVERSE_LUNGE' : 'REVERSE_LUNGE';
  if (/\bside\b|\blateral\b/.test(n)) return g.band ? 'BANDED_SIDE_LUNGE' : 'LATERAL_LUNGE';
  if (/\bcurtsy\b/.test(n)) return 'CURTSY_LUNGE';
  if (/\boverhead\b/.test(n)) return g.barbell ? 'BARBELL_OVERHEAD_LUNGE' : g.plate ? 'OVERHEAD_PLATE_LUNGE' : 'OVERHEAD_LUNGE';
  if (/\bjump/.test(n)) return 'ALTERNATING_JUMP_LUNGE';
  return g.smith ? 'SMITH_MACHINE_LUNGE' : g.barbell ? 'BARBELL_LUNGE' : g.kettlebell ? 'KETTLEBELL_LUNGE' : 'LUNGE_GENERIC';
});
rule(/\bstep ?ups?\b|\bsubida no (banco|caixote)\b/, g => (g.barbell ? 'BARBELL_STEP_UP' : 'STEP_UP'));
rule(/\bleg press\b/, g => (/\bcalf\b|\bpanturrilha\b/.test(g.n) ? 'MACHINE_CALF_PRESS' : one.test(g.n) ? 'MACHINE_SINGLE_LEG_PRESS' : 'MACHINE_LEG_PRESS'));
rule(/\bhack\b/, () => 'MACHINE_HACK_SQUAT');
rule(/\bpendulum squat\b/, () => 'PENDULUM_SQUAT');
rule(/\bbelt squat\b/, () => 'BELT_SQUAT');
rule(/\bsissy squat\b/, () => 'SISSY_SQUAT');
rule(/\bpistol\b/, g => (/\bassisted\b/.test(g.n) ? 'ASSISTED_PISTOL_SQUATS' : 'PISTOL_SQUAT'));
rule(/\bgoblet\b/, g => (g.dumbbell ? 'DUMBBELL_GOBLET_SQUATS' : 'GOBLET_SQUAT'));
rule(/\bfront squat\b|\bagachamento frontal\b/, () => 'BARBELL_FRONT_SQUAT');
rule(/\boverhead squat\b/, () => 'OVERHEAD_SQUAT');
rule(/\bzercher\b/, () => 'ZERCHER_SQUAT');
rule(/\bbox squat\b/, () => 'BARBELL_BOX_SQUAT');
rule(/\bsumo squat\b|\bagachamento sumo\b/, () => 'SUMO_SQUAT');
rule(/\bcossack\b/, () => 'COSSACK_SQUAT');
rule(/\bwall sit\b|\bcadeirinha\b/, () => 'WALL_SIT');
rule(/\bjump squat\b|\bsquat jump\b|\bagachamento com salto\b/, () => 'BODY_WEIGHT_JUMP_SQUAT');
rule(/\bleg extension\b|\bextensora\b|\bquad extension\b/, g => (g.band ? 'BANDED_QUAD_EXTENSION' : one.test(g.n) ? 'MACHINE_SINGLE_LEG_QUAD_EXTENSION' : 'MACHINE_LEG_EXTENSION'));
rule(/\bsquats?\b|\bagachamento\b/, g => (g.smith ? 'SMITH_MACHINE_SQUAT' : g.barbell ? 'BARBELL_BACK_SQUAT' : g.dumbbell ? 'DUMBBELL_SQUAT' : g.kettlebell ? 'KETTLEBELL_SQUAT' : g.machine ? 'SQUAT_GENERIC' : g.eq === 'body weight' ? 'AIR_SQUAT' : 'SQUAT_GENERIC'));
rule(/\bnordic\b/, () => 'NORDIC_CURL');
rule(/\bglute ham raise\b|\bghr\b/, () => 'GLUTE_HAM_RAISE');
rule(/\b(leg|hamstring) curls?\b|\bflexora\b|\bmesa flexora\b|\bcadeira flexora\b/, g => {
  if (g.band) return 'BANDED_HAMSTRING_CURL';
  if (/\bseated\b|\bcadeira\b|\bsentad/.test(g.n)) return one.test(g.n) ? 'MACHINE_SINGLE_LEG_CURL_SEATED' : 'MACHINE_LEG_CURL_SEATED';
  if (/\bstanding\b|\bem pe\b/.test(g.n)) return 'STANDING_LEG_CURL';
  if (/\bslid/.test(g.n)) return 'SLIDING_LEG_CURL';
  return 'LEG_CURL_GENERIC';
});
rule(/\bcalf\b|\bcalves\b|\bpanturrilha\b|\bgemeos\b/, g => {
  if (/\bseated\b|\bsentad/.test(g.n)) return g.dumbbell ? 'SEATED_DUMBBELL_CALF_RAISE' : 'SEATED_CALF_RAISE';
  if (/\bpress\b/.test(g.n)) return 'MACHINE_CALF_PRESS';
  if (one.test(g.n)) return g.dumbbell ? 'SINGLE_LEG_DUMBBELL_STANDING_CALF_RAISE' : g.barbell ? 'SINGLE_LEG_BARBELL_CALF_RAISE' : 'SINGLE_LEG_STANDING_CALF_RAISE';
  if (/\bwalking\b/.test(g.n)) return g.dumbbell ? 'DUMBBELL_WALKING_CALF_RAISES' : 'WALKING_CALF_RAISES';
  if (/\bstanding\b|\bem pe\b/.test(g.n)) return g.machine ? 'MACHINE_CALF_EXTENSION' : 'STANDING_CALF_RAISE';
  return 'CALF_RAISE_GENERIC';
});
rule(/\btibialis\b|\btibial\b/, () => 'TIBIALIS_RAISE');
// Chest.
rule(/\bfloor press\b/, g => (g.dumbbell ? (one.test(g.n) ? 'SINGLE_ARM_DUMBBELL_FLOOR_PRESS' : 'DUMBBELL_FLOOR_PRESS') : g.barbell ? 'BARBELL_FLOOR_PRESS' : 'FLOOR_BENCH_PRESS'));
rule(/\bsqueeze press\b/, () => 'DUMBBELL_SQUEEZE_PRESS');
rule(/\bsvend\b/, () => 'SVEND_PRESS_PLATE_SQUEEZE');
rule(/\bjm press\b/, () => 'JM_PRESS');
rule(/\bbench press\b|\bsupino\b|\bchest press\b/, g => {
  const n = g.n;
  const incline = /\bincline\b|\binclinado\b/.test(n), decline = /\bdecline\b|\bdeclinado\b/.test(n);
  if (incline) {
    if (g.smith) return 'SMITH_MACHINE_INCLINE_BENCH_PRESS';
    if (g.dumbbell) return /\bneutral\b|\bneutra\b/.test(n) ? 'NEUTRAL_GRIP_DUMBBELL_INCLINE_BENCH_PRESS' : 'INCLINE_DUMBBELL_BENCH_PRESS';
    if (g.barbell) return 'INCLINE_BARBELL_BENCH_PRESS';
    if (g.machine) return 'MACHINE_INCLINE_CHEST_PRESS';
    return 'BENCH_PRESS_GENERIC';
  }
  if (decline) return g.dumbbell ? 'DECLINE_DUMBBELL_BENCH_PRESS' : g.machine ? 'MACHINE_DECLINE_BENCH_PRESS' : 'BENCH_PRESS_GENERIC';
  if (/\bclose\b|\bnarrow\b|\bfechad/.test(n)) return g.dumbbell ? 'CLOSE_GRIP_DUMBBELL_CHEST_PRESS' : g.barbell ? 'CLOSE_GRIP_BARBELL_BENCH_PRESS' : 'BENCH_PRESS_GENERIC';
  if (/\bwide\b|\baberta\b/.test(n) && g.barbell) return 'WIDE_GRIP_BARBELL_BENCH_PRESS';
  if (one.test(n)) return g.cable ? 'SINGLE_ARM_CABLE_CHEST_PRESS' : g.dumbbell ? 'SINGLE_ARM_DUMBBELL_BENCH_PRESS' : 'BENCH_PRESS_GENERIC';
  if (/\bneutral\b|\bneutra\b/.test(n) && g.dumbbell) return 'NEUTRAL_GRIP_DUMBBELL_BENCH_PRESS';
  if (/\bpause/.test(n)) return 'PAUSED_BENCH_PRESS';
  if (/\bfeet up\b/.test(n)) return 'BARBELL_FEET_UP_BENCH_PRESS';
  if (g.machine || g.smith) return /\biso ?lateral\b/.test(n) ? 'MACHINE_ISOLATERAL_CHEST_PRESS' : 'MACHINE_CHEST_PRESS';
  if (g.dumbbell) return 'DUMBBELL_BENCH_PRESS';
  if (g.barbell) return 'BARBELL_BENCH_PRESS';
  if (g.plate) return 'PLATE_PRESS';
  return /\bchest press\b/.test(n) ? 'CHEST_PRESS' : 'BENCH_PRESS_GENERIC';
});
rule(/\brear delt|\breverse fly|\bcrucifixo invertido\b|\bcrucifixo inverso\b|\bvoador invertido\b/, g => (g.cable ? 'CABLE_REAR_DELT_FLY' : g.machine ? 'MACHINE_REAR_DELT_REVERSE_FLY' : /\bincline\b/.test(g.n) ? 'INCLINE_REVERSE_FLY' : 'DUMBBELL_REAR_DELT_FLY'));
rule(/\bpec ?deck\b|\bpeck ?deck\b|\bbutterfly\b|\bvoador\b/, () => 'PEC_DECK_BUTTERFLY');
rule(/\bfl(y|ye|yes|ies)\b|\bcrucifixo\b|\bcross ?over\b/, g => {
  if (g.cable) return /\blow\b|\bbaixo\b/.test(g.n) ? 'LOW_CABLE_FLY_CROSSOVERS' : /\bincline\b|\binclinado\b/.test(g.n) ? 'INCLINE_CABLE_FLY' : 'CABLE_CROSSOVER';
  if (g.machine) return 'MACHINE_CHEST_FLY';
  if (g.dumbbell) return /\bincline\b|\binclinado\b/.test(g.n) ? 'INCLINE_DUMBBELL_FLYE' : 'DUMBBELL_FLYE';
  return g.band ? 'BAND_CHEST_FLY' : g.suspension ? 'SUSPENSION_CHEST_FLY' : g.kettlebell ? 'KETTLEBELL_FLYE' : 'FLYE_GENERIC';
});
rule(/\bpush ?ups?\b|\bpress ?ups?\b|\bflexao\b/, g => {
  const n = g.n;
  if (/\bhandstand\b/.test(n)) return 'HANDSTAND_PUSH_UP';
  if (/\bdecline\b|\bdeclinad/.test(n)) return 'DECLINE_PUSH_UP';
  if (/\bincline\b|\binclinad/.test(n)) return 'INCLINE_PUSH_UP';
  if (/\bdiamond\b|\bdiamante\b/.test(n)) return 'DIAMOND_PUSH_UP';
  if (/\bpike\b/.test(n)) return 'PIKE_PUSH_UP';
  if (/\barcher\b/.test(n)) return 'ARCHER_PUSH_UP';
  if (/\bclap\b/.test(n)) return 'CLAP_PUSH_UPS';
  if (/\bwall\b|\bparede\b/.test(n)) return 'WALL_PUSH_UP';
  if (one.test(n)) return 'ONE_ARM_PUSH_UP';
  if (/\bknee|\bjoelho/.test(n)) return 'MODIFIED_PUSH_UP';
  return 'PUSH_UP_GENERIC';
});
// Back.
rule(/\bmuscle ?ups?\b/, g => (/\bring\b/.test(g.n) ? 'RING_MUSCLE_UP' : /\bbar\b/.test(g.n) ? 'BAR_MUSCLE_UP' : 'MUSCLE_UP'));
rule(/\bchin ?ups?\b/, g => (/\bassist/.test(g.n) || g.eq === 'assisted' ? 'ASSISTED_CHIN_UP' : /\bweighted\b/.test(g.n) || g.eq === 'weighted' ? 'WEIGHTED_CHIN_UP' : 'CLOSE_GRIP_CHIN_UP'));
rule(/\bpull ?ups?\b|\bbarra fixa\b/, g => {
  const n = g.n;
  if (/\bassist/.test(n) || g.eq === 'assisted' || g.machine) return 'MACHINE_ASSISTED_PULL_UP';
  if (/\bnegative\b/.test(n)) return 'NEGATIVE_PULL_UP';
  if (/\bring\b/.test(n)) return 'RING_PULL_UP';
  if (/\bchest to bar\b/.test(n)) return 'CHEST_TO_BAR_PULL_UP';
  if (/\barcher\b/.test(n)) return 'ARCHER_PULL_UP';
  if (/\bneutral\b|\bneutra\b/.test(n)) return 'NEUTRAL_GRIP_PULL_UP';
  if (/\bwide\b|\baberta\b/.test(n)) return 'WIDE_PULL_UP';
  if (/\bsupinad|\bunderhand\b/.test(n)) return 'CLOSE_GRIP_CHIN_UP';
  return 'PULL_UP_GENERIC';
});
rule(/\bstraight arm (pull ?down|lat)\b|\bpull ?down com bracos? estendidos?\b|\bpulldown bracos estendidos\b/, () => 'STRAIGHT_ARM_PULLDOWN');
rule(/\bpull ?down\b|\bpuxada\b|\bpulley\b/, g => {
  const n = g.n;
  if (/\bstraight arm\b|\bestendid/.test(n)) return 'STRAIGHT_ARM_PULLDOWN';
  if (one.test(n)) return 'SINGLE_ARM_LAT_PULLDOWN';
  if (/\bunderhand\b|\breverse grip\b|\bsupinad/.test(n)) return 'UNDERHAND_LAT_PULLDOWN';
  if (/\bneutral\b|\bneutra\b|\bv ?bar\b|\btriangulo\b/.test(n)) return 'NEUTRAL_GRIP_LAT_PULLDOWN';
  if (/\bclose\b|\bnarrow\b|\bfechad/.test(n)) return 'CABLE_LAT_PULLDOWN_CLOSE_GRIP';
  return 'LAT_PULLDOWN';
});
rule(/\bface ?pull\b/, () => 'FACE_PULL');
rule(/\bpull ?over\b/, g => (g.machine ? 'MACHINE_PULLOVER' : 'DUMBBELL_PULLOVER'));
rule(/\bupright row\b|\bremada alta\b/, g => (g.cable ? 'CABLE_UPRIGHT_ROW' : g.kettlebell ? 'KETTLEBELL_UPRIGHT_ROW' : 'BARBELL_UPRIGHT_ROW'));
rule(/\brows?\b|\bremada\b/, g => {
  const n = g.n;
  if (/\bt ?bar\b|\bcavalinho\b/.test(n)) return 'T_BAR_ROW';
  if (/\blandmine\b/.test(n) || g.eq === 'landmine') return 'LANDMINE_ROW';
  if (/\bseal\b/.test(n)) return 'SEAL_ROW';
  if (/\bmeadows\b/.test(n)) return 'MEADOWS_ROW';
  if (/\brenegade\b/.test(n)) return 'RENEGADE_ROW';
  if (/\binverted\b|\binvertida\b|\bbody ?weight row\b|\baustralian\b/.test(n)) return 'INVERTED_ROW';
  if (/\bring\b/.test(n)) return 'RING_ROW';
  if (g.suspension) return 'SUSPENSION_LOW_ROW';
  if (/\bgorilla\b/.test(n)) return 'GORILLA_ROW';
  if (/\bchest supported\b|\bapoiad/.test(n)) return g.machine ? 'MACHINE_CHEST_SUPPORTED_ROW' : 'CHEST_SUPPORTED_ROW';
  if (g.smith) return 'SMITH_MACHINE_ROW';
  if (g.cable) return 'SEATED_CABLE_ROW';
  if (g.machine) return /\bhigh\b/.test(n) ? 'MACHINE_ISOLATERAL_HIGH_ROW' : one.test(n) ? 'MACHINE_SINGLE_ARM_SEATED_ROW' : 'MACHINE_SEATED_ROW';
  if (g.kettlebell) return 'KETTLEBELL_ROW';
  if (g.barbell) return /\breverse\b|\bunderhand\b|\bsupinad/.test(n) ? 'REVERSE_GRIP_BARBELL_ROW' : 'BENT_OVER_BARBELL_ROW';
  if (g.dumbbell) return /\bbent over\b|\bcurvad/.test(n) && !one.test(n) ? 'BENT_OVER_DUMBBELL_ROW' : 'DUMBBELL_ROW';
  return /\bbent over\b|\bcurvad/.test(n) ? 'BENT_OVER_ROW' : 'ROW_GENERIC';
});
rule(/\bshrugs?\b|\bencolhimento\b/, g => (g.barbell || g.trap ? 'BARBELL_SHRUG' : g.dumbbell ? 'DUMBBELL_SHRUG' : 'SHRUG_GENERIC'));
// Shoulders.
rule(/\blateral raise\b|\bside raise\b|\belevacao lateral\b|\blateral delt raise\b/, g => (g.cable ? 'CABLE_LATERAL_RAISE' : g.dumbbell && /\bseated\b|\bsentad/.test(g.n) ? 'SEATED_DUMBBELL_LATERAL_RAISE' : 'LATERAL_RAISE_GENERIC'));
rule(/\bfront (shoulder )?raise\b|\belevacao frontal\b/, g => (g.plate ? 'PLATE_FRONT_RAISE' : 'FRONT_RAISE'));
rule(/\bpull ?aparts?\b/, g => (g.cable ? 'CABLE_PULL_APART' : 'BAND_PULLAPARTS'));
rule(/\barnold\b/, () => 'ARNOLD_PRESS');
rule(/\bz ?press\b/, () => 'Z_PRESS');
rule(/\blandmine (squat (and|to) )?press\b/, () => 'LANDMINE_SQUAT_AND_PRESS');
rule(/\bpush press\b/, g => (g.dumbbell ? 'DUMBBELL_PUSH_PRESS' : g.barbell ? 'BARBELL_PUSH_PRESS' : 'PUSH_PRESS'));
rule(/\bshoulder press\b|\boverhead press\b|\bmilitary press\b|\bdesenvolvimento\b|\bohp\b/, g => {
  const n = g.n, seated = /\bseated\b|\bsentad/.test(n);
  if (/\bbehind (the )?(neck|head)\b|\bnuca\b/.test(n)) return 'BARBELL_BEHIND_THE_HEAD_SHOULDER_PRESS';
  if (g.smith) return 'SMITH_MACHINE_OVERHEAD_PRESS';
  if (g.machine) return one.test(n) ? 'MACHINE_SINGLE_ARM_SEATED_SHOULDER_PRESS' : 'MACHINE_SEATED_SHOULDER_PRESS';
  if (one.test(n)) return 'STANDING_SINGLE_ARM_SHOULDER_PRESS';
  if (g.dumbbell) return seated ? 'SEATED_DUMBBELL_SHOULDER_PRESS' : 'OVERHEAD_DUMBBELL_PRESS';
  if (g.barbell) return seated ? 'SEATED_BARBELL_PRESS' : 'OVERHEAD_BARBELL_PRESS';
  return 'SHOULDER_PRESS_GENERIC';
});
// Arms.
rule(/\bskull ?crushers?\b|\blying triceps? extension\b|\btriceps? testa\b|\btesta\b/, g => (g.dumbbell ? 'DUMBBELL_SKULLCRUSHER' : 'SKULL_CRUSHER'));
rule(/\bpush ?down\b|\bpress ?down\b|\btriceps? (na )?polia\b|\btriceps? corda\b|\btriceps? pulley\b/, g => (one.test(g.n) ? 'CABLE_SINGLE_ARM_TRICEPS_PUSHDOWN' : g.cable || /\bpolia\b|\bcorda\b|\bpulley\b/.test(g.n) ? 'CABLE_TRICEPS_PUSHDOWN' : 'TRICEPS_PRESSDOWN'));
rule(/\bkick ?back\b|\bcoice\b/, g => (g.cable && g.tg !== 'triceps' ? 'CABLE_KICKBACK' : 'DUMBBELL_KICKBACK'));
rule(/\bdips?\b|\bmergulho\b|\bparalelas?\b/, g => {
  const n = g.n;
  if (/\bbench\b|\bbanco\b/.test(n)) return /\bstraight leg\b/.test(n) ? 'STRAIGHT_LEG_BENCH_DIP' : 'BENCH_DIP';
  if (/\bring\b/.test(n)) return 'RING_DIP';
  if (/\bchair\b|\bcadeira\b/.test(n)) return 'CHAIR_DIPS';
  if (/\bfloor\b/.test(n)) return 'FLOOR_TRICEPS_DIP';
  if (/\bassist/.test(n) || g.eq === 'assisted') return 'ASSISTED_CHEST_DIP';
  if (g.machine) return 'SEATED_DIP_MACHINE';
  if (/\bweighted\b/.test(n) || g.eq === 'weighted') return 'WEIGHTED_CHEST_DIP';
  if (/\bchest\b|\bpeito\b/.test(n) || g.tg === 'pectorals') return 'CHEST_DIP';
  if (g.tg === 'triceps') return 'TRICEP_DIP';
  return 'BODY_WEIGHT_DIP';
});
rule(/\btriceps?\b.*\bextension\b|\bextension\b.*\btriceps?\b|\btriceps? frances\b|\bfrances\b|\btriceps? (overhead|acima)\b/, g => {
  if (g.cable) return 'CABLE_OVERHEAD_TRICEPS_EXTENSION';
  if (g.machine) return 'MACHINE_TRICEP_EXTENSION';
  if (g.dumbbell) return one.test(g.n) ? 'DUMBBELL_SINGLE_ARM_TRICEP_EXTENSION' : 'OVERHEAD_DUMBBELL_TRICEPS_EXTENSION';
  if (g.barbell) return 'SEATED_BARBELL_OVERHEAD_TRICEPS_EXTENSION';
  return 'TRICEPS_EXTENSION_GENERIC';
});
rule(/\bwrist roller\b|\brolo de punho\b/, () => 'WRIST_ROLLER');
rule(/\bwrist (curl|extension)\b|\brosca (de )?punho\b/, g => {
  const rev = /\breverse\b|\binvers|\bextension\b|\bpronad/.test(g.n);
  if (/\bbehind (the )?back\b/.test(g.n)) return 'BARBELL_BEHIND_THE_BACK_BICEP_WRIST_CURL';
  if (g.dumbbell) return rev ? 'DUMBBELL_REVERSE_WRIST_CURL' : 'DUMBBELL_WRIST_CURL';
  if (g.barbell) return rev ? 'BARBELL_REVERSE_WRIST_CURL' : 'BARBELL_WRIST_CURL';
  return 'CURL_GENERIC';
});
rule(/\bcurls?\b|\brosca\b/, g => {
  const n = g.n;
  if (/\bhammer\b|\bmartelo\b/.test(n)) return g.cable ? 'CABLE_HAMMER_CURL' : /\bcross ?body\b|\bcruzad/.test(n) ? 'CROSS_BODY_HAMMER_CURL' : 'DUMBBELL_HAMMER_CURL';
  if (/\bpreacher\b|\bscott\b/.test(n)) return g.machine ? 'PREACHER_CURL_MACHINE' : g.ez || g.barbell ? 'EZ_BAR_PREACHER_CURL' : 'CURL_GENERIC';
  if (/\bconcentrat|\bconcentrad/.test(n)) return 'CONCENTRATION_CURL';
  if (/\bspider\b/.test(n)) return 'SPIDER_CURL';
  if (/\bdrag\b/.test(n)) return 'DRAG_CURL';
  if (/\bbayesian\b/.test(n)) return 'BAYESIAN_CURL';
  if (/\bzottman\b/.test(n)) return 'DUMBBELL_ZOTTMAN_CURL';
  if (/\b21s?\b/.test(n)) return 'TWENTY_ONES_BICEP_CURL';
  if (/\breverse\b|\binvers|\bpronad/.test(n)) return g.cable ? 'REVERSE_CABLE_CURLS' : g.barbell ? 'BARBELL_REVERSE_CURL' : 'CURL_GENERIC';
  if (g.cable) return /\boverhead\b|\bhigh\b/.test(n) ? 'CABLE_OVERHEAD_CURL' : /\brope\b|\bcorda\b/.test(n) ? 'ROPE_CABLE_CURL' : 'CABLE_BICEPS_CURL';
  if (g.dumbbell && /\bincline\b|\binclinad/.test(n)) return 'INCLINE_DUMBBELL_BICEPS_CURL';
  if (g.machine) return 'MACHINE_BICEP_CURL';
  if (g.kettlebell) return 'KETTLEBELL_BICEPS_CURL';
  if (g.plate) return 'PLATE_CURL';
  if (g.suspension) return 'SUSPENSION_BICEP_CURL';
  if (g.ez) return 'STANDING_EZ_BAR_BICEPS_CURL';
  if (g.barbell) return 'BARBELL_BICEPS_CURL';
  if (g.dumbbell) return 'STANDING_DUMBBELL_BICEPS_CURL';
  return 'CURL_GENERIC';
});
// Core.
rule(/\bside plank\b|\bprancha lateral\b/, () => 'SIDE_PLANK');
rule(/\bcopenhagen\b/, () => 'SL_COPENHAGEN_PLANK');
rule(/\bplanks?\b|\bprancha\b/, g => (/\bshoulder tap/.test(g.n) ? 'PLANK_SHOULDER_TAP' : /\breverse\b/.test(g.n) ? 'REVERSE_PLANK' : 'PLANK_GENERIC'));
rule(/\bab wheel\b|\brollout\b|\broll out\b|\broda abdominal\b|\brodinha\b/, g => (g.barbell ? 'BARBELL_ROLLOUT' : 'AB_WHEEL_ROLLOUT'));
rule(/\brussian twist\b/, g => (g.dumbbell ? 'DUMBBELL_RUSSIAN_TWIST' : 'RUSSIAN_TWIST'));
rule(/\btoes? to bar\b/, () => 'TOES_TO_BAR');
rule(/\bhanging\b.*\b(leg|knee) raise\b|\belevacao de pernas na barra\b/, g => (/\bknee\b/.test(g.n) ? 'HANGING_KNEE_RAISE' : 'HANGING_LEG_RAISE'));
rule(/\bleg raise\b|\belevacao de pernas\b|\bknee raise\b/, g => (/\bcaptain|\bparallel\b|\bdip station\b|\bparalela/.test(g.n) ? 'LEG_RAISE_PARALLEL_BARS' : /\blying\b|\bdeitad/.test(g.n) ? (/\bknee\b/.test(g.n) ? 'LYING_KNEE_RAISE' : 'LYING_STRAIGHT_LEG_RAISE') : 'LEG_RAISE_GENERIC'));
rule(/\bflutter kicks?\b/, () => 'FLUTTER_KICKS');
rule(/\bdead ?bugs?\b/, g => (g.band ? 'BANDED_DEADBUG' : 'DEADBUG'));
rule(/\bbird ?dogs?\b/, () => 'BIRD_DOG');
rule(/\bdragon flag\b/, () => 'DRAGON_FLAG');
rule(/\bpallof\b/, () => 'PALLOF_PRESS');
rule(/\bwood ?chop|\blenhador\b/, () => 'CABLE_WOODCHOP');
rule(/\bchop\b/, () => 'CHOP_GENERIC');
rule(/\bside bend\b|\bflexao lateral\b/, g => (g.dumbbell ? 'DUMBBELL_SIDE_BEND' : g.cable ? 'CABLE_SIDE_BEND' : 'SIDE_BEND'));
rule(/\bwindmill\b/, () => 'KETTLEBELL_WINDMILL');
rule(/\bhollow\b/, () => 'HOLLOW_ROCK');
rule(/\bv ?ups?\b/, () => 'V_UP');
rule(/\bsit ?ups?\b/, g => (/\bghd\b/.test(g.n) ? 'GHD_SIT_UP' : 'SIT_UP_GENERIC'));
rule(/\bcrunch|\babdominal\b/, g => {
  const n = g.n;
  if (g.cable) return 'CABLE_CRUNCH';
  if (g.machine) return 'AB_CRUNCH_MACHINE';
  if (/\breverse\b|\binfra\b/.test(n)) return 'REVERSE_CRUNCH';
  if (/\bdecline\b|\bdeclinad/.test(n)) return g.eq === 'weighted' || g.dumbbell || g.plate ? 'WEIGHTED_DECLINE_CRUNCH' : 'DECLINE_CRUNCH';
  if (/\boblique|\bobliquo/.test(n)) return 'OBLIQUE_CRUNCH';
  if (g.eq === 'medicine ball') return 'MEDICINE_BALL_CRUNCH';
  return 'CRUNCH';
});
// Jumps.
rule(/\bbox jumps?\b|\bsalto no caixote\b/, () => 'BOX_JUMP');
rule(/\bbroad jump\b|\bsalto horizontal\b/, () => 'BROAD_JUMP');
rule(/\bdepth jump\b/, () => 'DEPTH_JUMP');
rule(/\bslams?\b/, () => 'MEDICINE_BALL_SLAM');
rule(/\bpogo\b/, () => 'POGO_JUMPS');
rule(/\bjumps?\b|\bsaltos?\b/, () => 'PLYO_GENERIC');

// Nothing in the name: the family the muscle it trains belongs to.
const BY_TARGET = {
  abs: 'CORE_GENERIC', obliques: 'CORE_GENERIC', 'serratus anterior': 'CORE_GENERIC', 'hip flexors': 'CORE_GENERIC',
  lats: 'PULL_UP_GENERIC', 'upper back': 'ROW_GENERIC', pectorals: 'BENCH_PRESS_GENERIC', hamstrings: 'LEG_CURL_GENERIC',
  triceps: 'TRICEPS_EXTENSION_GENERIC', 'cardiovascular system': 'CARDIO_GENERIC', spine: 'HYPEREXTENSION_GENERIC',
  quads: 'SQUAT_GENERIC', biceps: 'CURL_GENERIC', glutes: 'HIP_RAISE_GENERIC', 'side delts': 'LATERAL_RAISE_GENERIC',
  'front delts': 'SHOULDER_PRESS_GENERIC', 'rear delts': 'SHOULDER_STABILITY_GENERIC', forearms: 'CURL_GENERIC',
  traps: 'SHRUG_GENERIC', calves: 'CALF_RAISE_GENERIC', adductors: 'HIP_STABILITY_GENERIC', abductors: 'HIP_STABILITY_GENERIC',
  shins: 'TIBIALIS_RAISE', 'levator scapulae': 'WARM_UP_GENERIC',
};
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Strava's exercise_type for an exercise: { id, name } as the workout payload has it (the catalogue
 * gives the English name, equipment and target muscle when the id is one of its own).
 * Always one of STRAVA_EXERCISES.
 */
export function stravaExercise(e) {
  const lib = LIB_BY_ID.get(String(e?.id));
  const n = norm(lib?.n || e?.name || e?.id);
  const eq = lib?.eq || null;
  const tg = lib?.tg || null;
  if (eq === 'roller' || eq === 'massage ball') return 'WARM_UP_GENERIC';
  const g = { ...gear(n, eq), n, eq, tg };
  for (const [re, pick] of R) {
    if (!re.test(n)) continue;
    const id = pick(g);
    if (STRAVA_EXERCISES.has(id)) return id;
  }
  return BY_TARGET[tg] || 'TOTAL_BODY_GENERIC';
}
