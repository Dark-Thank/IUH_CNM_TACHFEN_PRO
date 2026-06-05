using NAudio.Lame;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

var sampleRate = 22050;
var channelCount = 1;
var totalDuration = TimeSpan.FromSeconds(2.4);
var outputPath = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "frontend", "public", "incoming-call.mp3"));
var waveFormat = WaveFormat.CreateIeeeFloatWaveFormat(sampleRate, channelCount);
var pcmFormat = new WaveFormat(sampleRate, 16, channelCount);

ISampleProvider CreateTone(double frequency, double startSeconds, double durationSeconds, float gain)
{
    var signal = new SignalGenerator(sampleRate, channelCount)
    {
        Frequency = frequency,
        Gain = gain,
        Type = SignalGeneratorType.Sin,
    };

    return new OffsetSampleProvider(signal)
    {
        DelayBy = TimeSpan.FromSeconds(startSeconds),
        Take = TimeSpan.FromSeconds(durationSeconds),
        LeadOut = TimeSpan.FromSeconds(Math.Max(0, totalDuration.TotalSeconds - startSeconds - durationSeconds)),
    };
}

var silence = new SignalGenerator(sampleRate, channelCount)
{
    Frequency = 440,
    Gain = 0,
    Type = SignalGeneratorType.Sin,
};

var baseTrack = new OffsetSampleProvider(silence)
{
    Take = totalDuration,
};

var mixer = new MixingSampleProvider(waveFormat)
{
    ReadFully = true,
};

mixer.AddMixerInput(baseTrack);
mixer.AddMixerInput(CreateTone(740, 0.0, 0.26, 0.42f));
mixer.AddMixerInput(CreateTone(740, 0.34, 0.26, 0.38f));
mixer.AddMixerInput(CreateTone(880, 1.05, 0.20, 0.30f));

using var writer = new LameMP3FileWriter(outputPath, pcmFormat, LAMEPreset.VBR_90);
var waveProvider = new SampleToWaveProvider16(mixer);
var buffer = new byte[pcmFormat.AverageBytesPerSecond / 2];
int bytesRead;

while ((bytesRead = waveProvider.Read(buffer, 0, buffer.Length)) > 0)
{
    writer.Write(buffer, 0, bytesRead);
}

Console.WriteLine(outputPath);
