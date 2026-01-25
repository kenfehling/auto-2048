import { AI } from '../src/ai.js';
import { assert } from 'console';

function testMonotonicity() {
  console.log('Running Monotonicity Logic Tests...');
  const ai = new AI();

  const mockGame = (gridArray) => ({
    grid: gridArray.map(row => row.map(val => val === 0 ? null : { value: val })),
    over: false,
    movesAvailable: () => true
  });

  // Test Case 1: Perfect Snake (Orderly)
  const orderlyGrid = [
    [2048, 1024, 512, 256],
    [16, 32, 64, 128],
    [8, 4, 2, 0],
    [0, 0, 0, 0]
  ];
  const score1 = ai.evaluate(mockGame(orderlyGrid));

  // Test Case 2: Broken Snake (Messy)
  const messyGrid = [
    [1024, 2048, 512, 256], // 2048 is not in corner!
    [16, 32, 64, 128],
    [8, 4, 2, 0],
    [0, 0, 0, 0]
  ];
  const score2 = ai.evaluate(mockGame(messyGrid));

  console.log(`Orderly Score: ${score1.toExponential(2)}`);
  console.log(`Messy Score:   ${score2.toExponential(2)}`);

  if (score1 > score2) {
    console.log('✅ PASS: Orderly grid scored higher than messy grid.');
  } else {
    console.error('❌ FAIL: Messy grid scored higher or equal to orderly grid.');
    process.exit(1);
  }

  // Test Case 3: Max Tile not in corner
  const maxInCorner = [
    [2048, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const maxNotInCorner = [
    [0, 2048, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];
  const score3 = ai.evaluate(mockGame(maxInCorner));
  const score4 = ai.evaluate(mockGame(maxNotInCorner));

  console.log(`Max In Corner: ${score3.toExponential(2)}`);
  console.log(`Max Not In Corner: ${score4.toExponential(2)}`);

  if (score3 > score4) {
    console.log('✅ PASS: Max tile in corner scored higher.');
  } else {
    console.error('❌ FAIL: Max tile position weight is insufficient.');
    process.exit(1);
  }
}

testMonotonicity();
