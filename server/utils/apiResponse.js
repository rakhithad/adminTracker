const apiResponse = {
    success: (res, data, status = 200) => {
      res.status(status).json({ success: true, data });
    },
    error: (res, message, status = 400) => {
      res.status(status).json({ success: false, error: message });
    }
  };
  
  module.exports = apiResponse;