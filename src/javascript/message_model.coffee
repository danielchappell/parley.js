## constructor for object that contains all logic and data
## associated with individual messages

class Message

  constructor: (@recipients, @sender, @content, @time_stamp) ->
    if not @time_stamp
      @time_stamp = new Date()

  time_elapsed: ->
    current_time = new Date()
    ## Convert to minutes
    minutes = Math.floor(( current_time - @time_created) / 60000 )
    ## determine if today
    if current_time.getDate() is @time_created.getDate() and minutes < 1440
      today = true
    ## Convert to hours
    hours = Math.floor((minutes / 60 ))
    minute_remainder = Math.floor((minutes % 60 ))
    ## format message
    if minutes < 60
      return "#{minutes} mins ago"
    if hours < 4
      if minute_remainder is 0
        return "#{hours} hours ago"
      else
        return "#{hours} hour #{minute_remainder} min ago"
    else
      ## long term message format
      f_date = @date_formatter()
      if today
        return "#{f_date.hour}:#{f_date.minutes} #{f_date.suffix}"
      else
        return "#{f_date.month} #{f_date.day} | #{f_date.hour}:#{f_date.minutes} #{f_date.suffix}"

  date_formatter: ->
    ## formats date for @time_elapsed function

    switch @time_stamp.getMonth()
      when 0 then new_month = "Jan"
      when 1 then new_month = "Feb"
      when 2 then new_month = "Mar"
      when 3 then new_month = "Apr"
      when 4 then new_month = "May"
      when 5 then new_month = "Jun"
      when 6 then new_month = "Jul"
      when 7 then new_month = "Aug"
      when 8 then new_month = "Sep"
      when 9 then new_month = "Oct"
      when 10 then new_month = "Nov"
      when 11 then new_month = "Dec"

    hours = @time_stamp.getHours()
    if hours > 12
      suffix = "PM"
      new_hour = hours - 12
    else
      suffix = "AM"
      new_hour = hours

    minutes = @time_stamp.getMinutes()
    if minutes < 10
      new_minutes = "0#{minutes}"
    else
      new_minutes = "#{minutes}"

    formated =
      month: new_month
      day: @time_stamp.getDate()
      hour: new_hour
      minutes: new_minutes
      suffix: suffix




