/*
 * Copyright 2021 @OpenAdvice
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 *    http://www.apache.org/licenses/LICENSE-2.0
 */

/*
 * --------------------------------------------------------------------------------
 * Description:
 *        TODO:
 * --------------------------------------------------------------------------------
 */

exports.getCurrentDate = () => {
  let d = new Date();
  d =
    d.getFullYear() +
    '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) +
    '-' +
    ('0' + d.getDate()).slice(-2) +
    ' ' +
    ('0' + d.getHours()).slice(-2) +
    ':' +
    ('0' + d.getMinutes()).slice(-2) +
    ':' +
    ('0' + d.getSeconds()).slice(-2);
  return d;
};

exports.validateIPaddress = (givenIP) => {
  const ipFormat =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  if (givenIP.match(ipFormat)) {
    return true;
  } else {
    return false;
  }
};
