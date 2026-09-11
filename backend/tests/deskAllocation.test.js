const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chooseDesks, DeskError} = require('../src/services/deskAllocation');
const desks = [{id:1,number:1,status:'FIXED'},{id:2,number:2,status:'FREE'},{id:3,number:3,status:'OCCUPIED'},{id:4,number:4,status:'FREE'}];
test('automatic assignment excludes fixed/occupied desks and preserves a previous available desk', () => {
  assert.deepEqual(chooseDesks(desks,1),[2]);
  assert.deepEqual(chooseDesks(desks,1,undefined,[4]),[4]);
  assert.deepEqual(chooseDesks(desks,2),[2,4]);
});
test('admin selection requires exactly one distinct free desk per attendee', () => {
  assert.deepEqual(chooseDesks(desks,2,[4,2]),[4,2]);
  for (const selection of [[2,2],[1,2],[2,3],[99,2],['2',4],[],null]) assert.throws(() => chooseDesks(desks,2,selection),DeskError);
});
test('invalid attendee counts and insufficient availability fail without a partial allocation', () => {
  for(const count of [0,-1,1.5,NaN,3]) assert.throws(() => chooseDesks(desks,count),DeskError);
});
