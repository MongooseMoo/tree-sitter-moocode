if (typeof(x) == LIST)
// <- keyword
//  ^ function.builtin
//         ^ variable
//               ^ variable.builtin
  y = list;
//    ^ variable.builtin
  z = this.list;
//    ^ variable.builtin
//         ^ property
  w = player:verb(args, Dobjstr);
//    ^ variable.builtin
//           ^ function.method
//                ^ variable.builtin
//                      ^ variable.builtin
  v = {INT, NUM, FLOAT, OBJ, STR, ERR, MAP, BOOL, ANON, WAIF};
//     ^ variable.builtin
//          ^ variable.builtin
//               ^ variable.builtin
//                      ^ variable.builtin
//                           ^ variable.builtin
//                                ^ variable.builtin
//                                     ^ variable.builtin
//                                          ^ variable.builtin
//                                                ^ variable.builtin
//                                                      ^ variable.builtin
  u = {caller, argstr, dobj, prepstr, iobj, iobjstr};
//     ^ variable.builtin
//             ^ variable.builtin
//                     ^ variable.builtin
//                           ^ variable.builtin
//                                    ^ variable.builtin
//                                          ^ variable.builtin
  t = true || FALSE;
//    ^ constant.builtin
//            ^ constant.builtin
  s = listing;
//    ^ variable
endif
